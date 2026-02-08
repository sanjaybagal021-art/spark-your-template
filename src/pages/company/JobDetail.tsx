/**
 * JobDetail - Full job record display page
 * 
 * Purpose: Show job metadata and lifecycle state.
 * Backend-authoritative: All data from GET /api/company/jobs/:jobId
 * 
 * RULES:
 * - No frontend calculations
 * - Actions disabled based on backend status only
 * - Re-fetch after every action
 */

import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Briefcase, 
  MapPin, 
  Users, 
  Clock, 
  ArrowLeft, 
  Play, 
  Eye, 
  FileText,
  CheckCircle2,
  Loader2,
  IndianRupee,
  Gift,
  BarChart3
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import CompanyHeader from '@/components/CompanyHeader';
import { toast } from 'sonner';
import { getJobById, processJob } from '@/api/companyJobs.api';
import { CompanyJobSchema } from '@/schemas/api.schemas';
import type { CompanyJob } from '@/types/company';

const JobDetail: React.FC = () => {
  const navigate = useNavigate();
  const { jobId } = useParams<{ jobId: string }>();
  const [job, setJob] = useState<CompanyJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  const fetchJob = async () => {
    if (!jobId) return;
    
    try {
      setLoading(true);
      const data = await getJobById(jobId);
      
      if (!data) {
        toast.error('Job not found');
        navigate('/company/jobs/status', { replace: true });
        return;
      }

      // Zod validation - fail fast on schema mismatch
      const validated = CompanyJobSchema.parse(data);
      setJob(validated as CompanyJob);
    } catch (error) {
      console.error('[JobDetail] Failed to fetch job:', error);
      toast.error('Failed to load job details');
      navigate('/company/jobs/status', { replace: true });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJob();
  }, [jobId]);

  const handleProcessJob = async () => {
    if (!jobId) return;
    
    try {
      setProcessing(true);
      await processJob(jobId);
      toast.success('Job submitted for processing');
      // Re-fetch to get updated status
      await fetchJob();
    } catch (error) {
      console.error('[JobDetail] Processing failed:', error);
      toast.error('Failed to process job');
    } finally {
      setProcessing(false);
    }
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: CompanyJob['status']) => {
    switch (status) {
      case 'draft':
        return 'bg-muted text-muted-foreground';
      case 'processing':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'matched':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'closed':
        return 'bg-secondary text-secondary-foreground';
      default:
        return '';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
        <CompanyHeader title="Job Details" />
        <div className="max-w-3xl mx-auto p-6 space-y-6">
          <Skeleton className="h-8 w-48" />
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-64" />
              <Skeleton className="h-4 w-32 mt-2" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-20 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!job) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <CompanyHeader title="Job Details" />

      <div className="max-w-3xl mx-auto p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          {/* Back Navigation */}
          <Button 
            variant="ghost" 
            onClick={() => navigate('/company/jobs/status')}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Job Status
          </Button>

          {/* Main Job Card */}
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Briefcase className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">{job.title}</CardTitle>
                    <CardDescription className="flex items-center gap-2 mt-1">
                      <MapPin className="w-3 h-3" />
                      {job.location.label}
                    </CardDescription>
                  </div>
                </div>
                <Badge className={`capitalize ${getStatusColor(job.status)}`}>
                  {job.status === 'processing' && (
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  )}
                  {job.status === 'matched' && (
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                  )}
                  {job.status}
                </Badge>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-6">
              {/* Key Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <Users className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Intake</p>
                    <p className="font-semibold text-foreground">{job.intake}</p>
                  </div>
                </div>
                
                {job.stipend && (
                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <IndianRupee className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Stipend</p>
                      <p className="font-semibold text-foreground">
                        ₹{job.stipend.toLocaleString('en-IN')}/mo
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <Clock className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Created</p>
                    <p className="font-semibold text-foreground text-sm">
                      {formatDate(job.createdAt)}
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Required Skills */}
              <div>
                <h3 className="text-sm font-medium text-foreground mb-3">
                  Required Skills ({job.requiredSkills.length})
                </h3>
                <div className="flex flex-wrap gap-2">
                  {job.requiredSkills.map((skill) => (
                    <Badge key={skill} variant="outline">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Perks */}
              {job.perks && (
                <>
                  <Separator />
                  <div className="flex items-start gap-3">
                    <Gift className="w-5 h-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-foreground mb-1">Perks</p>
                      <p className="text-sm text-muted-foreground">{job.perks}</p>
                    </div>
                  </div>
                </>
              )}

              <Separator />

              {/* Original JD */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <h3 className="text-sm font-medium text-foreground">Original Job Description</h3>
                </div>
                <div className="bg-muted/30 rounded-lg p-4 max-h-48 overflow-y-auto">
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {job.originalJD}
                  </p>
                </div>
              </div>

              {/* Lifecycle Timestamps */}
              <Separator />
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Created At</p>
                  <p className="font-medium text-foreground">{formatDate(job.createdAt)}</p>
                </div>
                {job.processedAt && (
                  <div>
                    <p className="text-muted-foreground">Processed At</p>
                    <p className="font-medium text-foreground">{formatDate(job.processedAt)}</p>
                  </div>
                )}
                {job.closedAt && (
                  <div>
                    <p className="text-muted-foreground">Closed At</p>
                    <p className="font-medium text-foreground">{formatDate(job.closedAt)}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons - Based on Backend Status Only */}
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Process Job - Only for draft status */}
            {job.status === 'draft' && (
              <Button 
                onClick={handleProcessJob}
                disabled={processing}
                className="flex-1"
              >
                {processing ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Play className="w-4 h-4 mr-2" />
                )}
                Run NLP Processing
              </Button>
            )}

            {/* View Matches - Only for matched/closed status */}
            {(job.status === 'matched' || job.status === 'closed') && (
              <Button 
                onClick={() => navigate(`/company/jobs/matches/${job.id}`)}
                className="flex-1"
              >
                <Eye className="w-4 h-4 mr-2" />
                View Matched Candidates
              </Button>
            )}

            {/* View Summary - Available for matched/closed */}
            {(job.status === 'matched' || job.status === 'closed') && (
              <Button 
                variant="outline"
                onClick={() => navigate(`/company/jobs/${job.id}/summary`)}
                className="flex-1"
              >
                <BarChart3 className="w-4 h-4 mr-2" />
                View Allocator Summary
              </Button>
            )}
          </div>

          {/* Processing Notice */}
          {job.status === 'processing' && (
            <div className="mt-6 bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Loader2 className="w-5 h-5 text-amber-500 animate-spin mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-foreground">Processing in progress</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Our system is analyzing your job requirements. This page will update automatically when matching is complete.
                  </p>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default JobDetail;
