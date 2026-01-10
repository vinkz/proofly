'use client';

import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { supabaseBrowser } from '@/lib/supabaseClient';
import { uploadJobFile } from '@/server/job-files';

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';

export default function StorageTestPage() {
  const [jobId, setJobId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [successPath, setSuccessPath] = useState('');
  const [publicUrl, setPublicUrl] = useState('');
  const [uploadedRow, setUploadedRow] = useState<Awaited<ReturnType<typeof uploadJobFile>> | null>(null);

  const supabase = useMemo(() => supabaseBrowser(), []);

  const handleUpload = async () => {
    const trimmedJobId = jobId.trim();
    setErrorMessage('');
    setSuccessPath('');
    setPublicUrl('');
    setUploadedRow(null);

    if (!trimmedJobId) {
      setStatus('error');
      setErrorMessage('Job ID is required.');
      return;
    }

    if (!file) {
      setStatus('error');
      setErrorMessage('Please choose a file to upload.');
      return;
    }

    setStatus('uploading');

    try {
      const row = await uploadJobFile({ jobId: trimmedJobId, kind: 'fga_screenshot', file });
      const { data: publicData } = supabase.storage.from('job-files').getPublicUrl(row.storage_path);
      setUploadedRow(row);
      setSuccessPath(row.storage_path);
      setPublicUrl(publicData?.publicUrl ?? '');
      setStatus('success');
    } catch (error) {
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Upload failed');
      return;
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-muted">Storage test</h1>
        <p className="text-sm text-muted-foreground/70">
          Upload a file to the <span className="font-semibold">job-files</span> bucket for a specific job.
        </p>
      </div>

      <Card className="border border-white/10">
        <CardHeader>
          <CardTitle className="text-lg text-muted">Upload test</CardTitle>
          <CardDescription className="text-sm text-muted-foreground/70">
            Policies require the path to start with <span className="font-semibold">jobs/{'{jobId}'}/...</span>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">Job ID</label>
            <Input
              value={jobId}
              onChange={(event) => setJobId(event.target.value)}
              placeholder="Job UUID"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">File</label>
            <Input
              type="file"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </div>

          <Button
            type="button"
            className="rounded-full"
            variant="primary"
            onClick={handleUpload}
            disabled={status === 'uploading'}
          >
            {status === 'uploading' ? 'Uploading…' : 'Upload'}
          </Button>

          {status === 'error' ? (
            <p className="text-sm text-red-500">{errorMessage}</p>
          ) : null}

          {status === 'success' ? (
            <div className="space-y-2 text-sm text-muted-foreground/80">
              <p className="font-semibold text-muted">Upload successful.</p>
              <p>Object path: <span className="font-mono text-xs">{successPath}</span></p>
              {uploadedRow ? (
                <pre className="whitespace-pre-wrap rounded-lg bg-white/60 p-3 text-xs text-muted">
                  {JSON.stringify(uploadedRow, null, 2)}
                </pre>
              ) : null}
              {publicUrl ? (
                <p>
                  Public URL: <span className="font-mono text-xs">{publicUrl}</span>
                </p>
              ) : (
                <p className="text-xs text-muted-foreground/70">
                  Public URL not available (bucket may be private).
                </p>
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
