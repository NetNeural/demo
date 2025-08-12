import { supabase } from './index';

export class StorageManager {
  private bucketName: string;

  constructor(bucketName: string = 'uploads') {
    this.bucketName = bucketName;
  }

  // Upload a file
  async uploadFile(
    path: string,
    file: File | Blob | ArrayBuffer,
    options?: { 
      cacheControl?: string;
      contentType?: string;
      upsert?: boolean;
    }
  ) {
    const { data, error } = await supabase.storage
      .from(this.bucketName)
      .upload(path, file, options);
    
    return { data, error };
  }

  // Download a file
  async downloadFile(path: string) {
    const { data, error } = await supabase.storage
      .from(this.bucketName)
      .download(path);
    
    return { data, error };
  }

  // Get public URL for a file
  getPublicUrl(path: string) {
    const { data } = supabase.storage
      .from(this.bucketName)
      .getPublicUrl(path);
    
    return data.publicUrl;
  }

  // Delete a file
  async deleteFile(path: string) {
    const { data, error } = await supabase.storage
      .from(this.bucketName)
      .remove([path]);
    
    return { data, error };
  }

  // List files in a directory
  async listFiles(path?: string, options?: { limit?: number; offset?: number }) {
    const { data, error } = await supabase.storage
      .from(this.bucketName)
      .list(path, options);
    
    return { data, error };
  }

  // Create a bucket
  async createBucket(bucketName: string, options?: { public?: boolean }) {
    const { data, error } = await supabase.storage
      .createBucket(bucketName, { public: options?.public ?? false });
    
    return { data, error };
  }

  // Delete a bucket
  async deleteBucket(bucketName: string) {
    const { data, error } = await supabase.storage
      .deleteBucket(bucketName);
    
    return { data, error };
  }
}

export const storageManager = new StorageManager();
