'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { cn } from '@/lib/utils';

type MarkdownArticleProps = {
  articleID: string;
  language?: string;
  fallbackLanguage?: string;
  className?: string;
};

const normalizeLanguage = (value: string | undefined) => {
  if (!value) return '';
  return value.toLowerCase().split('-')[0] || '';
};

const getLanguageCandidates = (
  language: string | undefined,
  fallbackLanguage: string | undefined,
) => {
  return Array.from(
    new Set(
      [normalizeLanguage(language), normalizeLanguage(fallbackLanguage)].filter(
        Boolean,
      ),
    ),
  );
};

const isExternalHref = (href: string) => /^https?:\/\//i.test(href);

export function MarkdownArticle({
  articleID,
  language,
  fallbackLanguage = 'en',
  className,
}: MarkdownArticleProps) {
  const { t, i18n } = useTranslation();
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);

  const languageCandidates = useMemo(
    () =>
      getLanguageCandidates(
        language || i18n.resolvedLanguage || i18n.language,
        fallbackLanguage,
      ),
    [language, i18n.resolvedLanguage, i18n.language, fallbackLanguage],
  );

  useEffect(() => {
    const controller = new AbortController();
    const loadArticle = async () => {
      setLoading(true);
      for (const candidate of languageCandidates) {
        try {
          const response = await fetch(
            `/articles/${candidate}/${articleID}.md`,
            {
              cache: 'force-cache',
              signal: controller.signal,
            },
          );
          if (!response.ok) {
            continue;
          }
          setContent(await response.text());
          setLoading(false);
          return;
        } catch (error) {
          if ((error as { name?: string }).name === 'AbortError') {
            return;
          }
        }
      }
      setContent('');
      setLoading(false);
    };

    void loadArticle();

    return () => {
      controller.abort();
    };
  }, [articleID, languageCandidates]);

  if (loading) {
    return (
      <div className={cn('text-sm text-muted-foreground', className)}>
        {t('common.loading')}
      </div>
    );
  }

  if (!content) {
    return (
      <div className={cn('text-sm text-muted-foreground', className)}>
        {t('common.articleUnavailable')}
      </div>
    );
  }

  return (
    <div className={cn('text-sm', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: props => (
            <h1
              className='scroll-m-20 text-center text-4xl font-extrabold tracking-tight text-balance'
              {...props}
            />
          ),
          h2: props => (
            <h2
              className='scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight first:mt-0'
              {...props}
            />
          ),
          h3: props => (
            <h3
              className='scroll-m-20 text-2xl font-semibold tracking-tight'
              {...props}
            />
          ),
          h4: props => (
            <h4
              className='scroll-m-20 text-xl font-semibold tracking-tight'
              {...props}
            />
          ),
          p: props => (
            <p className='leading-7 [&:not(:first-child)]:mt-6' {...props} />
          ),
          ol: props => (
            <ol className='my-6 ml-6 list-decimal [&>li]:mt-2' {...props} />
          ),
          ul: props => (
            <ul className='my-6 ml-6 list-disc [&>li]:mt-2' {...props} />
          ),
          blockquote: props => (
            <blockquote className='mt-6 border-l-2 pl-6 italic' {...props} />
          ),
          table: ({ children }) => (
            <div className='my-6 w-full overflow-y-auto'>
              <table className='w-full'>{children}</table>
            </div>
          ),
          th: props => (
            <th
              className='border px-4 py-2 text-left font-bold [&[align=center]]:text-center [&[align=right]]:text-right'
              {...props}
            />
          ),
          td: props => (
            <td
              className='border px-4 py-2 text-left [&[align=center]]:text-center [&[align=right]]:text-right'
              {...props}
            />
          ),
          code: props => (
            <code
              className='bg-muted relative rounded px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold'
              {...props}
            />
          ),
          pre: props => (
            <pre
              className='mt-6 overflow-x-auto rounded-md border bg-muted p-4'
              {...props}
            />
          ),
          a: ({ href, ...props }) => (
            <a
              className='font-medium text-primary underline underline-offset-4'
              href={href}
              target={href && isExternalHref(href) ? '_blank' : undefined}
              rel={href && isExternalHref(href) ? 'noreferrer' : undefined}
              {...props}
            />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
