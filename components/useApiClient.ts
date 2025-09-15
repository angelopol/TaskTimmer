"use client";
import { signOut } from 'next-auth/react';
import { useCallback } from 'react';

interface ApiOptions extends RequestInit {
  json?: any;
  autoJSON?: boolean; // default true; when set, will JSON.stringify body & parse response
}

interface ApiResponse<T=any> {
  ok: boolean;
  status: number;
  data: T | null;
  error?: string | null;
  raw: Response;
}

// Hook returning a typed fetch wrapper that automatically:
//  - injects JSON headers (if json provided)
//  - stringifies body
//  - parses JSON
//  - on 401 triggers signOut() and returns early
//  - provides unified ApiResponse shape
export function useApiClient(){
  const apiFetch = useCallback(async function apiFetch<T=any>(url: string, opts: ApiOptions = {}): Promise<ApiResponse<T>>{
    const { json, autoJSON = true, headers, ...rest } = opts;
    const init: RequestInit = { ...rest, headers: { ...(headers||{}) } };
    if(json !== undefined){
      init.body = JSON.stringify(json);
      (init.headers as any)['Content-Type'] = 'application/json';
    }
    let res: Response;
    try {
      res = await fetch(url, init);
    } catch (e:any){
      return { ok:false, status:0, data:null, error: e.message || 'Network error', raw: new Response() };
    }
    if(res.status === 401){
      // Trigger signOut and surface unauthorized error
      signOut({ callbackUrl: '/login' });
      return { ok:false, status:401, data:null, error:'Unauthorized', raw: res };
    }
    if(!autoJSON){
      return { ok: res.ok, status: res.status, data: null as any, error: res.ok ? null : `HTTP ${res.status}`, raw: res };
    }
    let parsed: any = null;
    try { parsed = await res.json(); } catch { /* ignore parse errors */ }
    if(!res.ok){
      const err = parsed?.error || `HTTP ${res.status}`;
      return { ok:false, status: res.status, data:null, error: err, raw: res };
    }
    return { ok:true, status: res.status, data: parsed as T, error: null, raw: res };
  }, []);

  return { apiFetch };
}
