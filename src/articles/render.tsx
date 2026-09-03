import type { ReactNode } from "react";
import { articlesEditorStrings } from "@/i18n/articles-editor";
import type { Language } from "@/lib/types";
import type { Block, MediaBlock } from "./types";

type ArticleBodyProps = {
  blocks?: Block[];
  body?: string | { en?: string; ne?: string };
  language: Language;
};

function localizedBody(body: ArticleBodyProps["body"], language: Language) {
  if (typeof body === "string") return body;
  if (!body) return "";
  return language === "ne" ? body.ne || body.en || "" : body.en || body.ne || "";
}

function mediaCaption(caption: string | undefined, source: string, sourceLabel: string) {
  return (
    <figcaption className="mt-3 space-y-1 text-sm text-muted-foreground">
      {caption ? <span className="block">{caption}</span> : null}
      <span className="block">
        {sourceLabel}: {source}
      </span>
    </figcaption>
  );
}

function renderBlock(block: Block, sourceLabel: string, index: number): ReactNode {
  if (block.type === "paragraph")
    return (
      <p key={block.id ?? index} className="whitespace-pre-wrap break-words">
        {block.text}
      </p>
    );
  if (block.type === "heading")
    return (
      <h2 key={block.id ?? index} className="text-2xl font-bold tracking-tight">
        {block.text}
      </h2>
    );
  if (block.type === "quote") {
    return (
      <blockquote
        key={block.id ?? index}
        className="border-l-4 border-primary pl-5 text-lg italic text-muted-foreground whitespace-pre-wrap break-words"
      >
        {block.text}
      </blockquote>
    );
  }
  const media = block as MediaBlock;
  return (
    <figure key={block.id ?? index} className="my-8">
      {block.type === "image" ? (
        <img src={media.url} alt={media.caption || ""} className="w-full rounded-xl object-cover" loading="lazy" />
      ) : (
        <video src={media.url} controls preload="metadata" className="w-full rounded-xl" />
      )}
      {mediaCaption(media.caption, media.source, sourceLabel)}
    </figure>
  );
}

export function ArticleBody({ blocks, body, language }: ArticleBodyProps) {
  const sourceLabel = articlesEditorStrings[language].articleSource;
  if (!blocks) {
    return (
      <div className="text-base leading-8">
        <p className="whitespace-pre-wrap break-words">{localizedBody(body, language)}</p>
      </div>
    );
  }
  return <div className="space-y-8 text-base leading-8">{blocks.map((block, index) => renderBlock(block, sourceLabel, index))}</div>;
}
