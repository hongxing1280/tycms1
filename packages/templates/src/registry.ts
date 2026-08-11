import { jinqiuLiveTemplate } from './jinqiu-live';
import { lyboIndustrialTemplate } from './lybo-industrial';
import { qzcadPortalTemplate } from './qzcad-portal';
import type { TemplatePackage } from './types';

export const templateRecordKeyById: Record<string, string> = {
  'template-jinqiu-live': 'jinqiu-live',
  'template-lybo-industrial': 'lybo-industrial',
  'template-qzcad-portal': 'qzcad-portal',
};

export const templateRegistry: Record<string, TemplatePackage> = {
  'jinqiu-live': jinqiuLiveTemplate,
  'lybo-industrial': lyboIndustrialTemplate,
  'qzcad-portal': qzcadPortalTemplate,
};

export function getTemplatePackage(templateKey: string | null | undefined): TemplatePackage | undefined {
  return templateKey ? templateRegistry[templateKey] : undefined;
}

export function getTemplatePackageByRecordId(templateId: string | null | undefined): TemplatePackage | undefined {
  return templateId ? getTemplatePackage(templateRecordKeyById[templateId]) : undefined;
}
