import type { Metadata } from 'next';

type LiveFramePageProps = {
  searchParams?: {
    target?: string | string[];
    title?: string | string[];
  };
};

export const metadata: Metadata = {
  title: '播放源',
  robots: {
    index: false,
    follow: false,
  },
};

export default function LiveFramePage(props: LiveFramePageProps) {
  const target = safeFrameTarget(firstSearchParam(props.searchParams?.target));
  const title = firstSearchParam(props.searchParams?.title) || '播放产品';

  return (
    <main
      className="live-frame-page"
      data-frame-target={target ?? ''}
      data-frame-title={title}
      id="live-frame-root"
    >
      <div className="live-frame-empty">{target ? '正在加载播放源...' : '播放源地址无效'}</div>
      {target ? <script dangerouslySetInnerHTML={{ __html: liveFrameScript }} /> : null}
    </main>
  );
}

function firstSearchParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function safeFrameTarget(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

const liveFrameScript = `
(() => {
  const root = document.getElementById('live-frame-root');
  const target = root?.dataset.frameTarget;
  if (!root || !target) return;

  const iframe = document.createElement('iframe');
  iframe.src = target;
  iframe.title = root.dataset.frameTitle || '播放产品';
  iframe.allow = 'autoplay; fullscreen; picture-in-picture; encrypted-media';
  iframe.referrerPolicy = 'no-referrer-when-downgrade';
  iframe.setAttribute('allowfullscreen', 'true');

  root.replaceChildren(iframe);
})();
`;
