/**
 * JobSummary - Allocator Outcome Summary Page
 * 
 * Purpose: Make allocator behavior visible to the company.
 * This is NOT a match list - only shows job-level aggregates.
 * 
 * Backend-authoritative: All data from GET /api/company/jobs/:jobId/summary
 * 
 * RULES:
 * - No frontend calculations
 * - intakeFilled is NEVER computed locally
 * - All counts come from backend only
 */

import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, 
  Users, 
  CheckCircle2, 
  Clock, 
  XCircle,
  Briefcase,
  Eye,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import CompanyHeader from '@/components/CompanyHeader';
import { toast } from 'sonner';
import api from '@/utils/api';
import { getJobById } from '@/api/companyJobs.api';
import { CompanyJobSchema, JobSummaryResponseSchema } from '@/schemas/api.schemas';
import type { CompanyJob } from '@/types/company';
import type { JobSummaryResponse } from '@/schemas/api.schemas';

const JobSummary: React.FC = () => {
  const navigate = useNavigate();
  const { jobId } = useParams<{ jobId: string }>();
  const [job, setJob] = useState<CompanyJob | null>(null);
  const [summary, setSummary] = useState<JobSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    if (!jobId) return;
    
    try {
      setLoading(true);
      
      // Fetch job details
      const jobData = await getJobById(jobId);
      if (!jobData) {
        toast.error('Job not found');
        navigate('/company/jobs/status', { replace: true });
        return;
      }
      
      // Zod validation for job
      const validatedJob = CompanyJobSchema.parse(jobData);
      setJob(validatedJob as CompanyJob);

      // Fetch summary with intake param from job
      const summaryResponse = await api.get(`/api/company/jobs/${jobId}/summary`, {
        params: { intake: validatedJob.intake }
      });
      
      // Zod validation for summary - fail fast on schema mismatch
      const validatedSummary = JobSummaryResponseSchema.parse(summaryResponse.data);
      setSummary(validatedSummary);
      
    } catch (error) {
      console.error('[JobSummary] Failed to fetch data:', error);
      toast.error('Failed to load job summary');
      navigate('/company/jobs/status', { replace: true });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [jobId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
        <CompanyHeader title="Allocator Summary" />
        <div className="max-w-3xl mx-auto p-6 space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
        </div>
      </div>
    );
  }

  if (!job || !summary) {
    return null;
  }

  // Progress percentage from backend intakeFilled (NOT calculated locally)
  const progressPercentage = job.intake > 0 
    ? Math.min((summary.intakeFilled / job.intake) * 100, 100) 
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <CompanyHeader title="Allocator Summary" />

      <div className="max-w-3xl mx-auto p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          {/* Back Navigation */}
          <Button 
            variant="ghost" 
            onClick={() => navigate(`/company/jobs/${jobId}`)}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Job Details
          </Button>

          {/* Job Header */}
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Briefcase className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-xl">{job.title}</CardTitle>
                  <CardDescription>Allocator Outcome Summary</CardDescription>
                </div>
                <Badge 
                  className={`capitalize ${
                    job.status === 'matched' 
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
                      : 'bg-secondary text-secondary-foreground'
                  }`}
                >
                  {job.status}
                </Badge>
              </div>
            </CardHeader>
          </Card>

          {/* Intake Progress */}
          <Card className="mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Intake Progress</CardTitle>
              <CardDescription>
                {summary.intakeFilled} of {job.intake} positions filled
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Progress value={progressPercentage} className="h-3 mb-2" />
              <p className="text-sm text-muted-foreground text-right">
                {progressPercentage.toFixed(0)}% filled
              </p>
            </CardContent>
          </Card>

          {/* Summary Stats Grid */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            {/* Total Matches */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Users className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">
                      {summary.totalMatches}
                    </p>
                    <p className="text-sm text-muted-foreground">Total Matches</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Approved */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">
                      {summary.approvedCount}
                    </p>
                    <p className="text-sm text-muted-foreground">Approved</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Pending */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center">
                    <Clock className="w-6 h-6 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">
                      {summary.pendingCount}
                    </p>
                    <p className="text-sm text-muted-foreground">Pending</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Rejected */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                    <XCircle className="w-6 h-6 text-destructive" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">
                      {summary.rejectedCount}
                    </p>
                    <p className="text-sm text-muted-foreground">Rejected</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Intake Filled Card */}
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <AlertCircle className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Intake Filled</p>
                    <p className="text-2xl font-bold text-foreground">
                      {summary.intakeFilled} / {job.intake}
                    </p>
                  </div>
                </div>
                <Badge 
                  variant={summary.intakeFilled >= job.intake ? 'default' : 'outline'}
                  className={summary.intakeFilled >= job.intake 
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
                    : ''
                  }
                >
                  {summary.intakeFilled >= job.intake ? 'Fully Filled' : 'Open'}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button 
              onClick={() => navigate(`/company/jobs/${jobId}`)}
              variant="outline"
              className="flex-1"
            >
              <Briefcase className="w-4 h-4 mr-2" />
              View Job Details
            </Button>

            {(job.status === 'matched' || job.status === 'closed') && (
              <Button 
                onClick={() => navigate(`/company/jobs/matches/${jobId}`)}
                className="flex-1"
              >
                <Eye className="w-4 h-4 mr-2" />
                View Matched Candidates
              </Button>
            )}
          </div>

          {/* Backend Authority Notice */}
          <div className="mt-6 bg-muted/50 border border-border rounded-lg px-4 py-3">
            <p className="text-xs text-muted-foreground">
              All counts and intake status are calculated by the backend allocator. 
              This summary reflects the current system state.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default JobSummary;
