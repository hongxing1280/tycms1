import { cmsRepository } from '@sports/db';
import { AdminApp } from '../src/lib/AdminApp';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function AdminHome() {
  const metrics = [
    { label: '用户', value: cmsRepository.store.adminUsers.filter((user) => !user.deletedAt).length, icon: '👤' },
    { label: '角色', value: cmsRepository.store.adminRoles.filter((role) => !role.deletedAt).length, icon: '🔑' },
    { label: '站点', value: cmsRepository.store.sites.filter((site) => !site.deletedAt).length, icon: '🌐' },
    { label: '新闻', value: cmsRepository.store.news.filter((article) => !article.deletedAt).length, icon: '📰' },
    { label: '赛事', value: cmsRepository.store.matches.length, icon: '⚽' },
  ];

  return (
    <AdminApp>
      <div className="stats-grid">
        {metrics.map((metric) => (
          <div className="stat-card" key={metric.label}>
            <div className="stat-label">
              <span>{metric.icon}</span> {metric.label}
            </div>
            <div className="stat-value">{metric.value}</div>
          </div>
        ))}
      </div>
      
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">最近动态</h2>
        </div>
        <div className="card-body">
          <p style={{ color: 'var(--text-muted)' }}>欢迎来到体育站群管理后台。请从左侧菜单选择模块进行操作。</p>
        </div>
      </div>
    </AdminApp>
  );
}
