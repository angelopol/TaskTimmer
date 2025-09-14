import React from 'react';
import { AuthForm } from '../../../components/AuthForm';

export default function RegisterPage() {
  return (
    <div className="py-10">
      <h1 className="text-2xl font-bold mb-6 text-center">Registro</h1>
      <AuthForm mode="register" />
    </div>
  );
}
