"use client";
import { signOut } from 'next-auth/react';
import React from 'react';

// Provide a small logout button visually similar to the theme toggle (compact, subtle background on hover)
export default function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: '/' })}
      className="rounded px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-600 dark:text-gray-300"
    >
      Logout
    </button>
  );
}
