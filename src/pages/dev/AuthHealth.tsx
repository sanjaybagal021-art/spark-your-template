/**
 * Auth Health Debug Page - DEVELOPMENT ONLY
 * 
 * Displays raw /auth/me response for debugging auth state.
 * This page is only accessible in development mode.
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useUI } from '@/context/UIContext';
import api from '@/utils/api';
import { getAccessToken } from '@/api/auth.api';
import { RefreshCw, ArrowLeft, Copy, Check } from 'lucide-react';

interface RawAuthResponse {
  data: unknown;
  status: number;
  headers: Record<string, string>;
  timestamp: string;
}

const AuthHealth = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, isFullyVerified, refreshUser, isInitialized } = useUI();
  const [rawResponse, setRawResponse] = useState<RawAuthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Block access in production
  if (import.meta.env.PROD) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <p className="text-destructive font-medium">
              This page is only available in development mode.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const fetchRawAuthMe = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await api.get('/auth/me');
      setRawResponse({
        data: response.data,
        status: response.status,
        headers: Object.fromEntries(
          Object.entries(response.headers).filter(([, v]) => typeof v === 'string')
        ) as Record<string, string>,
        timestamp: new Date().toISOString(),
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      setRawResponse(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isInitialized) {
      fetchRawAuthMe();
    }
  }, [isInitialized]);

  const handleCopy = async () => {
    const data = {
      token: getAccessToken() ? '[PRESENT]' : '[ABSENT]',
      rawResponse,
      contextState: {
        user,
        isAuthenticated,
        isFullyVerified,
        isInitialized,
      },
    };
    
    await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const token = getAccessToken();

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Auth Health Debug</h1>
              <p className="text-muted-foreground text-sm">Development only</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleCopy}>
              {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
              {copied ? 'Copied' : 'Copy All'}
            </Button>
            <Button onClick={fetchRawAuthMe} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Token Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Token Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">aura_access_token:</span>
              <Badge variant={token ? 'default' : 'destructive'}>
                {token ? 'Present' : 'Absent'}
              </Badge>
            </div>
            {token && (
              <div className="bg-muted p-3 rounded-md font-mono text-xs break-all">
                {token.substring(0, 50)}...
              </div>
            )}
          </CardContent>
        </Card>

        {/* Context State */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">UIContext State</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <span className="text-muted-foreground text-sm">isInitialized</span>
                <Badge variant={isInitialized ? 'default' : 'secondary'} className="ml-2">
                  {String(isInitialized)}
                </Badge>
              </div>
              <div>
                <span className="text-muted-foreground text-sm">isAuthenticated</span>
                <Badge variant={isAuthenticated ? 'default' : 'secondary'} className="ml-2">
                  {String(isAuthenticated)}
                </Badge>
              </div>
              <div>
                <span className="text-muted-foreground text-sm">isFullyVerified</span>
                <Badge variant={isFullyVerified ? 'default' : 'secondary'} className="ml-2">
                  {String(isFullyVerified)}
                </Badge>
              </div>
              <div>
                <span className="text-muted-foreground text-sm">user.id</span>
                <Badge variant={user?.id ? 'default' : 'secondary'} className="ml-2">
                  {user?.id || 'null'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Hydrated User */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Hydrated User (from UIContext)</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted p-4 rounded-md text-xs overflow-auto max-h-64">
              {JSON.stringify(user, null, 2) || 'null'}
            </pre>
          </CardContent>
        </Card>

        {/* Raw /auth/me Response */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Raw /auth/me Response</CardTitle>
          </CardHeader>
          <CardContent>
            {error ? (
              <div className="bg-destructive/10 text-destructive p-4 rounded-md">
                <strong>Error:</strong> {error}
              </div>
            ) : rawResponse ? (
              <div className="space-y-4">
                <div className="flex gap-4 text-sm">
                  <span>
                    <span className="text-muted-foreground">Status:</span>{' '}
                    <Badge variant={rawResponse.status === 200 ? 'default' : 'destructive'}>
                      {rawResponse.status}
                    </Badge>
                  </span>
                  <span className="text-muted-foreground">
                    Fetched: {rawResponse.timestamp}
                  </span>
                </div>
                <pre className="bg-muted p-4 rounded-md text-xs overflow-auto max-h-96">
                  {JSON.stringify(rawResponse.data, null, 2)}
                </pre>
              </div>
            ) : (
              <p className="text-muted-foreground">Loading...</p>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Actions</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button variant="outline" onClick={() => refreshUser()}>
              Call refreshUser()
            </Button>
            <Button variant="outline" onClick={() => navigate('/login')}>
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AuthHealth;
