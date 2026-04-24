"use client"; // This component must be a client component

import {
  type UploadResponse,
  upload,
} from "@imagekit/next";
import { useState } from "react";

interface FileUploadProps {
  onSuccess: (res: UploadResponse) => void;
  onProgress?: (progress: number) => void;
  fileType?: "image" | "video";
}

const FileUpload = ({ onSuccess, onProgress, fileType }: FileUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getErrorMessage = async (res: Response, fallback: string) => {
    const raw = await res.text();
    if (!raw) {
      return fallback;
    }

    try {
      const parsed = JSON.parse(raw) as { error?: string; message?: string };
      return parsed.error || parsed.message || fallback;
    } catch {
      return fallback;
    }
  };

  //optional validation

  const validateFile = (file: File) => {
    if (fileType === "video") {
      if (!file.type.startsWith("video/")) {
        setError("Please upload a valid video file");
        return false;
      }
    }
    if (file.size > 100 * 1024 * 1024) {
      setError("File size must be less than 100 MB");
      return false;
    }
    return true;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (!file || !validateFile(file)) return;

    setUploading(true);
    setError(null);

    try {
      const authRes = await fetch("/api/imagekit-auth");
      if (!authRes.ok) {
        const message = await getErrorMessage(
          authRes,
          "Unable to get upload authorization."
        );

        if (authRes.status === 401 || authRes.status === 403) {
          throw new Error("Please log in to upload videos.");
        }

        throw new Error(message);
      }

      const auth = await authRes.json();
      const authParams = auth.authenticationParameters;
      const publicKey = process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY;

      if (!publicKey) {
        throw new Error("Missing NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY.");
      }

      if (!authParams?.signature || !authParams?.token || !authParams?.expire) {
        throw new Error("Invalid upload authorization response.");
      }

      const res = await upload({
        file,
        fileName: file.name,
        publicKey,
        signature: authParams.signature,
        expire: authParams.expire,
        token: authParams.token,
        onProgress: (event) => {
          if (event.lengthComputable && onProgress) {
            const percent = (event.loaded / event.total) * 100;
            onProgress(Math.round(percent));
          }
        },
      });
      if (!res.url) {
        throw new Error("Upload response did not include a file URL");
      }
      onSuccess(res);
    } catch (error) {
      console.error("Upload failed", error);
      setError(error instanceof Error ? error.message : "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <label className="relative inline-flex cursor-pointer">
        <input
          type="file"
          accept={fileType === "video" ? "video/*" : "image/*"}
          onChange={handleFileChange}
          disabled={uploading}
          className="hidden"
        />
        <span className="inline-flex items-center justify-center rounded-lg bg-linear-to-r from-blue-600 to-cyan-600 px-6 py-2 font-medium text-white shadow-lg transition-all duration-200 hover:shadow-cyan-600/50 hover:shadow-xl disabled:opacity-60 enabled:hover:from-blue-700 enabled:hover:to-cyan-700">
          {uploading ? "Uploading..." : `Choose ${fileType === "video" ? "Video" : "Image"}`}
        </span>
      </label>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
};

export default FileUpload;