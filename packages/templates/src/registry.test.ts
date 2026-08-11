import { describe, expect, it } from 'vitest';
import { getTemplatePackage, templateRegistry } from './registry';

describe('templateRegistry', () => {
  it('exposes the production templates', () => {
    expect(Object.keys(templateRegistry).sort()).toEqual(['jinqiu-live', 'lybo-industrial', 'qzcad-portal']);
  });

  it('registers the Jinqiu Live template package', () => {
    expect(templateRegistry['jinqiu-live']?.manifest).toMatchObject({
      key: 'jinqiu-live',
      name: '劲球直播风格 Jinqiu Live',
    });
    expect(getTemplatePackage('jinqiu-live')?.manifest.key).toBe('jinqiu-live');
  });

  it('registers the Lybo Industrial template package', () => {
    expect(templateRegistry['lybo-industrial']?.manifest).toMatchObject({
      key: 'lybo-industrial',
      name: '波佳管业企业模板 Lybo Industrial',
    });
    expect(getTemplatePackage('lybo-industrial')?.manifest.key).toBe('lybo-industrial');
  });

  it('registers the QZCAD portal template package', () => {
    expect(templateRegistry['qzcad-portal']?.manifest).toMatchObject({
      key: 'qzcad-portal',
      name: 'QZCAD 红色直播模板',
    });
    expect(getTemplatePackage('qzcad-portal')?.manifest.key).toBe('qzcad-portal');
  });

  it('does not fall back to another template for unknown keys', () => {
    expect(getTemplatePackage('unknown-template')).toBeUndefined();
    expect(getTemplatePackage(null)).toBeUndefined();
  });
});
