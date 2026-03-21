/**
 * 統一 Markdown 渲染工具
 * Unified Markdown Rendering Utility
 */

import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { setupKeywordHighlighting } from '@/utils/keywordHighlighting';

// 配置 marked 全域設定
marked.use({
  gfm: true, // GitHub Flavored Markdown
  breaks: true, // 將換行符轉換為 <br>
});

// 設定關鍵字高亮 (用於分析報告)
let keywordHighlightingSetup = false;

/**
 * 解析 Markdown 內容為 HTML
 * @param content Markdown 內容
 * @returns 渲染後的 HTML 字串
 */
export const parseMarkdown = (content: string): string => {
  if (!content) {
    return '';
  }

  try {
    const html = marked.parse(content) as string;
    return DOMPurify.sanitize(html);
  } catch (error) {
    console.warn('Markdown parsing error:', error);
    return content; // 回退到原始內容
  }
};

/**
 * 為聊天氣泡優化的 Markdown 解析
 * @param content Markdown 內容
 * @returns 渲染後的 HTML 字串
 */
export const parseChatMarkdown = (content: string): string => {
  return parseMarkdown(content);
};

/**
 * 為報告/分析優化的 Markdown 解析 (包含關鍵字高亮)
 * @param content Markdown 內容
 * @returns 渲染後的 HTML 字串
 */
export const parseReportMarkdown = (content: string): string => {
  // 確保關鍵字高亮只設定一次
  if (!keywordHighlightingSetup) {
    setupKeywordHighlighting();
    keywordHighlightingSetup = true;
  }

  return parseMarkdown(content);
};
