"use client";

import { useState } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface SectionPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sectionTitle: string;
  correctPassword: string;
  onUnlock: () => void;
}

export default function SectionPasswordDialog({
  open,
  onOpenChange,
  sectionTitle,
  correctPassword,
  onUnlock,
}: SectionPasswordDialogProps) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!password.trim()) {
      setError("Please enter a password");
      return;
    }

    if (password === correctPassword) {
      onUnlock();
      setPassword("");
      setError("");
      onOpenChange(false);
    } else {
      setError("Incorrect password. Please try again.");
      setPassword("");
    }
  };

  const handleClose = () => {
    setPassword("");
    setError("");
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={handleClose}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-gray-100 rounded-full">
              <Lock className="w-5 h-5 text-gray-600" />
            </div>
            <AlertDialogTitle className="text-lg font-semibold">
              Password Protected
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-sm text-gray-600 pt-2">
            This topic is password protected. Please enter the password below to
            access content (you will only need to do this once).
          </AlertDialogDescription>
        </AlertDialogHeader>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label
              htmlFor="section-password"
              className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <div className="relative">
              <input
                id="section-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
                className={`w-full px-4 py-2.5 pr-10 border rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent ${
                  error
                    ? "border-red-300 focus:ring-red-400"
                    : "border-gray-300"
                }`}
                placeholder="Enter password"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none">
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
            {error && (
              <p className="mt-2 text-sm text-red-600">{error}</p>
            )}
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              className="px-4">
              Cancel
            </Button>
            <Button type="submit" className="px-4">
              Unlock Topic
            </Button>
          </div>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
