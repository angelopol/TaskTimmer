"use client";
import { signOut } from 'next-auth/react';
import React from 'react';

export default function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: '/' })}
      className="text-sm text-red-600 underline"
    >
      Logout
    </button>
  );
}
