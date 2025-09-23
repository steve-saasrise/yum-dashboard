'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { createBrowserClient } from '@supabase/ssr';
import { toast } from 'sonner';
import { Loader2, Save, Upload, X } from 'lucide-react';

interface EmailAdvertiser {
  id?: string;
  position: number;
  company_name: string;
  logo_url: string;
  link_url: string;
  tagline: string;
  is_active: boolean;
}

export function EmailAdvertisersManager() {
  const [advertisers, setAdvertisers] = useState<{
    [key: number]: EmailAdvertiser;
  }>({
    1: {
      position: 1,
      company_name: '',
      logo_url: '',
      link_url: '',
      tagline: '',
      is_active: false,
    },
    2: {
      position: 2,
      company_name: '',
      logo_url: '',
      link_url: '',
      tagline: '',
      is_active: false,
    },
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | null>(null);
  const [uploading, setUploading] = useState<number | null>(null);
  const fileInputRefs = useRef<{ [key: number]: HTMLInputElement | null }>({});

  useEffect(() => {
    const fetchAdvertisers = async () => {
      console.log('Fetching advertisers...');
      setLoading(true);

      try {
        // Use fetch API directly to bypass potential Supabase client issues
        const response = await fetch('/api/email-advertisers');

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('Fetched advertisers:', data);

        const advertiserMap: { [key: number]: EmailAdvertiser } = {
          1: {
            position: 1,
            company_name: '',
            logo_url: '',
            link_url: '',
            tagline: '',
            is_active: false,
          },
          2: {
            position: 2,
            company_name: '',
            logo_url: '',
            link_url: '',
            tagline: '',
            is_active: false,
          },
        };

        if (data && data.length > 0) {
          data.forEach((ad: EmailAdvertiser) => {
            advertiserMap[ad.position] = ad;
          });
        }

        setAdvertisers(advertiserMap);
      } catch (error) {
        console.error('Error fetching advertisers:', error);
        // Don't show error toast, just use empty form
      } finally {
        setLoading(false);
      }
    };

    fetchAdvertisers();
  }, []);

  const saveAdvertiser = async (position: number) => {
    setSaving(position);
    const advertiser = advertisers[position];

    if (!advertiser) {
      toast.error('No advertiser data to save');
      setSaving(null);
      return;
    }

    try {
      const endpoint = advertiser.id
        ? '/api/email-advertisers'
        : '/api/email-advertisers';
      const method = advertiser.id ? 'PUT' : 'POST';

      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...advertiser,
          position,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save');
      }

      const data = await response.json();

      setAdvertisers((prev) => ({
        ...prev,
        [position]: data,
      }));

      toast.success(
        `Advertiser ${position} ${advertiser.id ? 'updated' : 'created'} successfully`
      );
    } catch (error: any) {
      console.error('Error saving advertiser:', error);
      toast.error(error.message || 'Failed to save advertiser');
    } finally {
      setSaving(null);
    }
  };

  const uploadLogo = async (position: number, file: File) => {
    if (!file) {
      console.error('No file provided');
      return;
    }

    console.log(
      'Starting upload for position',
      position,
      'file:',
      file.name,
      'size:',
      file.size
    );
    setUploading(position);

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Check auth session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    console.log('Auth session:', session ? 'exists' : 'missing', 'error:', sessionError);

    try {
      // Check file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('File size must be less than 5MB');
      }

      // Create a unique filename
      const fileExt = file.name.split('.').pop()?.toLowerCase();
      const fileName = `${position}-${Date.now()}.${fileExt}`;
      const filePath = `logos/${fileName}`;

      console.log('Uploading to path:', filePath);
      console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);

      // Upload the file with timeout
      console.log('Calling supabase.storage.upload...');

      const uploadPromise = supabase.storage
        .from('advertiser-logos')
        .upload(filePath, file, {
          upsert: true,
          cacheControl: '3600',
        });

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Upload timeout after 30 seconds')), 30000)
      );

      const { data: uploadData, error: uploadError } = await Promise.race([
        uploadPromise,
        timeoutPromise,
      ]).catch(err => ({ data: null, error: err })) as any;

      console.log('Upload response - data:', uploadData, 'error:', uploadError);

      if (uploadError) {
        console.error('Upload error details:', {
          message: uploadError.message,
          statusCode: uploadError.statusCode,
          error: uploadError,
        });
        throw uploadError;
      }

      console.log('Upload successful:', uploadData);

      // Get the public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from('advertiser-logos').getPublicUrl(filePath);

      console.log('Public URL:', publicUrl);

      // Update the advertiser with the new logo URL
      updateAdvertiser(position, 'logo_url', publicUrl);

      // Don't auto-save, just update the state
      // User can save manually with the Save Changes button
      toast.success('Logo uploaded successfully');
    } catch (error: any) {
      console.error('Full error object:', error);
      console.error('Error stack:', error.stack);
      toast.error(error.message || 'Failed to upload logo');
    } finally {
      console.log('Setting uploading to null');
      setUploading(null);
    }
  };

  const updateAdvertiser = (
    position: number,
    field: keyof EmailAdvertiser,
    value: any
  ) => {
    setAdvertisers((prev) => ({
      ...prev,
      [position]: {
        ...prev[position],
        [field]: value,
      },
    }));
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Email Digest Advertisers</CardTitle>
        <CardDescription>
          Manage the two advertiser slots that appear at the top of digest
          emails
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {[1, 2].map((position) => {
          const advertiser = advertisers[position];

          return (
            <div key={position} className="border rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">
                  Advertiser Position {position}
                </h3>
                <div className="flex items-center gap-2">
                  <Label htmlFor={`active-${position}`}>Active</Label>
                  <Switch
                    id={`active-${position}`}
                    checked={advertiser.is_active}
                    onCheckedChange={(checked) =>
                      updateAdvertiser(position, 'is_active', checked)
                    }
                  />
                </div>
              </div>

              <div className="grid gap-4">
                <div>
                  <Label htmlFor={`company-${position}`}>Company Name</Label>
                  <Input
                    id={`company-${position}`}
                    value={advertiser.company_name}
                    onChange={(e) =>
                      updateAdvertiser(position, 'company_name', e.target.value)
                    }
                    placeholder="e.g., VISTA POINT ADVISORS"
                  />
                </div>

                <div>
                  <Label htmlFor={`logo-${position}`}>Logo</Label>
                  <div className="space-y-2">
                    <input
                      ref={(el) => {
                        fileInputRefs.current[position] = el;
                      }}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          uploadLogo(position, file);
                        }
                        // Reset the input so the same file can be selected again
                        e.target.value = '';
                      }}
                    />
                    {advertiser.logo_url ? (
                      <div className="flex items-center gap-4">
                        <img
                          src={advertiser.logo_url}
                          alt={advertiser.company_name}
                          className="h-16 w-32 object-contain border rounded"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display =
                              'none';
                          }}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            updateAdvertiser(position, 'logo_url', '');
                          }}
                        >
                          <X className="h-4 w-4 mr-1" />
                          Remove
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={uploading === position}
                          onClick={() =>
                            fileInputRefs.current[position]?.click()
                          }
                        >
                          {uploading === position ? (
                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                          ) : (
                            <Upload className="h-4 w-4 mr-1" />
                          )}
                          Upload Logo
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <Label htmlFor={`link-${position}`}>Link URL</Label>
                  <Input
                    id={`link-${position}`}
                    value={advertiser.link_url}
                    onChange={(e) =>
                      updateAdvertiser(position, 'link_url', e.target.value)
                    }
                    placeholder="https://example.com"
                  />
                </div>

                <div>
                  <Label htmlFor={`tagline-${position}`}>Tagline</Label>
                  <Input
                    id={`tagline-${position}`}
                    value={advertiser.tagline}
                    onChange={(e) =>
                      updateAdvertiser(position, 'tagline', e.target.value)
                    }
                    placeholder="Brief description of the company"
                  />
                </div>

                <Button
                  onClick={() => saveAdvertiser(position)}
                  disabled={saving === position}
                  className="w-full sm:w-auto"
                >
                  {saving === position ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Save Advertiser {position}
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
