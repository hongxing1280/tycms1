'use client';

import type { FormEvent } from 'react';
import { useState } from 'react';
import React from 'react';
import { AdminLayout } from '../components/AdminLayout';
import { useAdmin } from './AdminContext';

export function AdminApp({
  children,
  safeEntry,
  allowLogin = false,
}: {
  children: React.ReactNode;
  safeEntry?: string;
  allowLogin?: boolean;
}) {
  const { session, status, isBooting, login, logout } = useAdmin();
  const [identity, setIdentity] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState('');

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setLocalError('');
    try {
      await login(identity, password, { safeEntry, totpCode });
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : '登录失败');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isBooting) {
    return (
      <div className="login-page">
        <div className="login-card" style={{ textAlign: 'center' }}>
          <div className="login-logo">SPORTS CMS</div>
          <div className="login-subtitle">正在恢复会话...</div>
        </div>
      </div>
    );
  }

  if (!session) {
    if (!allowLogin) {
      return (
        <div className="login-page">
          <div className="login-card" style={{ textAlign: 'center' }}>
            <div className="login-logo">404</div>
            <h2 className="login-title">页面不存在</h2>
          </div>
        </div>
      );
    }

    return (
      <div className="login-page">
        <div className="login-card">
          <div className="login-header">
            <div className="login-logo">SPORTS CMS</div>
            <h2 className="login-title">体育站群后台</h2>
            <p className="login-subtitle">统一管理账号、站点、内容和 SEO 配置。请从安全入口进入。</p>
          </div>
          
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label className="form-label">账号或邮箱</label>
              <input
                autoComplete="username"
                className="form-input"
                onChange={(event) => setIdentity(event.target.value)}
                placeholder="请输入用户名"
                value={identity}
              />
            </div>
            
            <div className="form-group">
              <label className="form-label">密码</label>
              <input
                autoComplete="current-password"
                className="form-input"
                onChange={(event) => setPassword(event.target.value)}
                placeholder="请输入密码"
                type="password"
                value={password}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Google 验证码</label>
              <input
                autoComplete="one-time-code"
                className="form-input"
                inputMode="numeric"
                maxLength={6}
                onChange={(event) => setTotpCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="请输入 6 位验证码"
                value={totpCode}
              />
            </div>
            
            <button className="btn btn-primary" disabled={isSubmitting} style={{ width: '100%', padding: '12px' }} type="submit">
              {isSubmitting ? '正在登录...' : '立即登录'}
            </button>
            
            {(status || localError) && (
              <div style={{ color: 'var(--danger)', fontSize: '13px', marginTop: '16px', textAlign: 'center', fontWeight: '600' }}>
                {status || localError}
              </div>
            )}
            
          </form>
        </div>
      </div>
    );
  }

  return (
    <AdminLayout onLogout={logout} user={session.user}>
      {children}
    </AdminLayout>
  );
}
