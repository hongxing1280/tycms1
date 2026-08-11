'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

type User = {
  displayName: string;
  username: string;
};

type AdminLayoutProps = {
  children: React.ReactNode;
  user?: User;
  onLogout?: () => void;
  metrics?: { label: string; value: number }[];
};

export function AdminLayout({ children, user, onLogout }: AdminLayoutProps) {
  const pathname = usePathname();

  const navGroups = [
    {
      title: '内容管理',
      items: [
        { label: '仪表盘', href: '/', icon: '📊' },
        { label: '新闻资讯', href: '/news', icon: '📰' },
        { label: '直播录像', href: '/live-replays', icon: '🎬' },
        { label: '栏目管理', href: '/categories', icon: '📁' },
      ],
    },
    {
      title: '站点与 SEO',
      items: [
        { label: '站点管理', href: '/sites', icon: '🌐' },
        { label: '分组管理', href: '/groups', icon: '🌿' },
        { label: '模板管理', href: '/templates', icon: '🎨' },
        { label: 'URL 配置', href: '/url-configs', icon: '🔗' },
        { label: 'TDK 配置', href: '/tdk-configs', icon: '📝' },
      ],
    },
    {
      title: '体育数据',
      items: [
        { label: '赛事管理', href: '/matches', icon: '⚽' },
        { label: '联赛管理', href: '/leagues', icon: '🏆' },
        { label: '球队管理', href: '/teams', icon: '🛡️' },
      ],
    },
    {
      title: '直播与信号',
      items: [
        { label: '直播产品', href: '/live-products', icon: '📺' },
        { label: '信号域名', href: '/signal-domains', icon: '📡' },
        { label: '信号源名称', href: '/signal-source-names', icon: '🏷️' },
      ],
    },
    {
      title: '推广管理',
      items: [
        { label: '推广类型', href: '/promotion-types', icon: '🎯' },
        { label: '推广链接', href: '/promotion-links', icon: '📣' },
      ],
    },
    {
      title: '系统管理',
      items: [
        { label: '用户管理', href: '/users', icon: '👤' },
        { label: '角色管理', href: '/roles', icon: '🔑' },
        { label: '权限管理', href: '/permissions', icon: '🛡️' },
        { label: '计划任务', href: '/scheduled-tasks', icon: '⏱️' },
      ],
    },
  ];

  return (
    <div className="admin-layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="user-avatar">{user?.displayName?.charAt(0) || 'A'}</div>
          <div className="sidebar-logo">SPORTS CMS</div>
        </div>

        <nav className="sidebar-nav">
          {navGroups.map((group) => (
            <div className="nav-group" key={group.title}>
              <div className="nav-group-title">{group.title}</div>
              {group.items.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    className={`nav-item ${isActive ? 'active' : ''}`}
                    href={item.href}
                    key={item.href}
                  >
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-profile">
            <div className="user-avatar small">{user?.displayName?.charAt(0) || 'A'}</div>
            <div className="user-info">
              <span className="user-name">{user?.displayName || 'Administrator'}</span>
              <span className="user-role">系统管理员</span>
            </div>
          </div>
          <button className="btn btn-danger" onClick={onLogout} style={{ width: '100%', marginTop: '12px' }}>
            <span>🚪</span>
            <span>退出登录</span>
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="top-bar">
          <div className="page-title-area">
            <h1>后台运营工作台</h1>
          </div>
        </header>

        <div className="content-body">{children}</div>
      </main>
    </div>
  );
}
