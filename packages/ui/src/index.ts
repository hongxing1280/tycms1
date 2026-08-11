export type UiSize = 'sm' | 'md' | 'lg';

export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}
