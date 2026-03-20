import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

export type KycLevel = 0 | 1 | 2;
export type KycStatus = "unverified" | "pending" | "verified" | "rejected";
export type DocType = "aadhaar" | "passport" | "driving_license" | "pan" | "address_proof" | "selfie";

export interface KycDocument {
  id: string;
  doc_type: DocType;
  file_url: string;
  file_name: string;
  status: "pending" | "approved" | "rejected";
  reject_reason: string | null;
  created_at: string;
}

export interface KycProfile {
  kyc_level: KycLevel;
  kyc_status: KycStatus;
  pan_number: string | null;
  aadhaar_number: string | null;
  date_of_birth: string | null;
  kyc_submitted_at: string | null;
  kyc_reviewed_at: string | null;
  kyc_reject_reason: string | null;
}

export function useKyc() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<KycProfile | null>(null);
  const [documents, setDocuments] = useState<KycDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const [profileRes, docsRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("kyc_level, kyc_status, pan_number, aadhaar_number, date_of_birth, kyc_submitted_at, kyc_reviewed_at, kyc_reject_reason")
        .eq("user_id", user.id)
        .single(),
      supabase
        .from("kyc_documents" as any)
        .select("id, doc_type, file_url, file_name, status, reject_reason, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
    ]);

    if (profileRes.data) {
      const d = profileRes.data as any;
      setProfile({
        kyc_level: (d.kyc_level ?? 0) as KycLevel,
        kyc_status: d.kyc_status as KycStatus,
        pan_number: d.pan_number,
        aadhaar_number: d.aadhaar_number,
        date_of_birth: d.date_of_birth,
        kyc_submitted_at: d.kyc_submitted_at,
        kyc_reviewed_at: d.kyc_reviewed_at,
        kyc_reject_reason: d.kyc_reject_reason,
      });
    }

    if (docsRes.data) {
      setDocuments(docsRes.data as any as KycDocument[]);
    }

    setLoading(false);
  }, [user]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Submit Level 1: basic ID info (PAN + Aadhaar + DOB)
  const submitLevel1 = async (pan: string, aadhaar: string, dob: string) => {
    if (!user) throw new Error("Not authenticated");
    const { error } = await supabase
      .from("profiles")
      .update({
        pan_number: pan,
        aadhaar_number: aadhaar,
        date_of_birth: dob,
        kyc_status: "pending",
        kyc_level: 1,
        kyc_submitted_at: new Date().toISOString(),
      } as any)
      .eq("user_id", user.id);
    if (error) throw error;
    await fetchAll();
  };

  // Upload a document file
  const uploadDocument = async (docType: DocType, file: File) => {
    if (!user) throw new Error("Not authenticated");
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/${docType}_${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("kyc-documents")
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("kyc-documents")
        .getPublicUrl(path);

      // Since bucket is private, we store the path and use signed URLs
      const { error: insertError } = await supabase
        .from("kyc_documents" as any)
        .insert({
          user_id: user.id,
          doc_type: docType,
          file_url: path,
          file_name: file.name,
        });
      if (insertError) throw insertError;

      await fetchAll();
    } finally {
      setUploading(false);
    }
  };

  // Submit Level 2: full verification (documents uploaded)
  const submitLevel2 = async () => {
    if (!user) throw new Error("Not authenticated");
    const { error } = await supabase
      .from("profiles")
      .update({
        kyc_status: "pending",
        kyc_level: 2,
        kyc_submitted_at: new Date().toISOString(),
      } as any)
      .eq("user_id", user.id);
    if (error) throw error;
    await fetchAll();
  };

  return {
    profile,
    documents,
    loading,
    uploading,
    submitLevel1,
    submitLevel2,
    uploadDocument,
    refresh: fetchAll,
  };
}
