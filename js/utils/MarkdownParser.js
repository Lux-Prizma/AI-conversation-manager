/**
 * Markdown Parser - Converts markdown to HTML
 * Supports: headers, bold, italic, code blocks, tables, lists, blockquotes, links, LaTeX
 */

import { HtmlUtils } from './HtmlUtils.js';

export class MarkdownParser {
    /**
     * Format markdown content to HTML
     * @param {string} content - Markdown content
     * @param {object} answer - Optional answer metadata for citations
     * @returns {string} HTML content
     */
    static format(content, answer = null) {
        let formatted = content;

        // Process ChatGPT citations if answer metadata is available
        if (answer && answer.metadata && answer.metadata.content_references) {
            formatted = this.processCitations(formatted, answer.metadata.content_references);
        }

        // Protect LaTeX sections by temporarily replacing them with placeholders
        const katexPlaceholders = this.processKaTeX(formatted);

        // Process markdown in order
        formatted = this.processCodeBlocks(formatted);
        formatted = this.processInlineCode(formatted);
        formatted = this.processTables(formatted);
        formatted = this.processHeaders(formatted);
        formatted = this.processBoldItalic(formatted);
        formatted = this.processHorizontalRules(formatted);
        formatted = this.processBlockquotes(formatted);
        formatted = this.processLists(formatted);
        formatted = this.processLinks(formatted);
        formatted = this.processParagraphs(formatted);

        // Restore KaTeX placeholders
        formatted = this.restoreKaTeX(formatted, katexPlaceholders);

        return formatted;
    }

    /**
     * Process ChatGPT citations
     */
    static processCitations(formatted, citations) {
        citations.forEach((citation, index) => {
            if (citation.matched_text && citation.items && citation.items.length > 0) {
                const item = citation.items[0];
                const url = item.url;
                const title = item.title || item.attribution || 'Source';

                const linkHtml = `<a href="${url}" target="_blank" rel="noopener noreferrer" class="message-link" title="${title}">[${index + 1}]</a>`;
                formatted = formatted.replace(citation.matched_text, linkHtml);
            }
        });

        return formatted;
    }

    /**
     * Process KaTeX equations
     * Returns array of placeholder HTML
     */
    static processKaTeX(formatted) {
        const katexPlaceholders = [];

        // Block math: \[...\] or $$...$$
        formatted = formatted.replace(/\\\[([\s\S]*?)\\\]/g, (match, math) => {
            try {
                if (typeof katex !== 'undefined') {
                    const html = katex.renderToString(math, { displayMode: true, throwOnError: false });
                    const placeholder = `__KATEX_BLOCK_${katexPlaceholders.length}__`;
                    katexPlaceholders.push(html);
                    return placeholder;
                }
            } catch (e) {
                console.error('KaTeX error:', e);
            }
            return match;
        });

        formatted = formatted.replace(/\$\$([\s\S]*?)\$\$/g, (match, math) => {
            try {
                if (typeof katex !== 'undefined') {
                    const html = katex.renderToString(math, { displayMode: true, throwOnError: false });
                    const placeholder = `__KATEX_BLOCK_${katexPlaceholders.length}__`;
                    katexPlaceholders.push(html);
                    return placeholder;
                }
            } catch (e) {
                console.error('KaTeX error:', e);
            }
            return match;
        });

        // Inline math: \(...\) or $...$
        formatted = formatted.replace(/\\\(([\s\S]*?)\\\)/g, (match, math) => {
            try {
                if (typeof katex !== 'undefined') {
                    const html = katex.renderToString(math, { displayMode: false, throwOnError: false });
                    const placeholder = `__KATEX_INLINE_${katexPlaceholders.length}__`;
                    katexPlaceholders.push(html);
                    return placeholder;
                }
            } catch (e) {
                console.error('KaTeX error:', e);
            }
            return match;
        });

        formatted = formatted.replace(/\$([^$\n]+?)\$/g, (match, math) => {
            try {
                if (typeof katex !== 'undefined') {
                    const html = katex.renderToString(math, { displayMode: false, throwOnError: false });
                    const placeholder = `__KATEX_INLINE_${katexPlaceholders.length}__`;
                    katexPlaceholders.push(html);
                    return placeholder;
                }
            } catch (e) {
                console.error('KaTeX error:', e);
            }
            return match;
        });

        return { formatted, placeholders: katexPlaceholders };
    }

    /**
     * Restore KaTeX placeholders with actual rendered HTML
     */
    static restoreKaTeX(formatted, katexPlaceholders) {
        return formatted.replace(/__KATEX_(BLOCK|INLINE)_(\d+)__/g, (match, type, index) => {
            return katexPlaceholders[parseInt(index)] || match;
        });
    }

    /**
     * Process code blocks
     */
    static processCodeBlocks(formatted) {
        return formatted.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
            return `<pre><code class="language-${lang || ''}">${code.trim()}</code></pre>`;
        });
    }

    /**
     * Process inline code
     */
    static processInlineCode(formatted) {
        return formatted.replace(/`([^`]+)`/g, '<code>$1</code>');
    }

    /**
     * Process tables
     */
    static processTables(formatted) {
        const lines = formatted.split('\n');
        let result = [];
        let i = 0;

        while (i < lines.length) {
            const line = lines[i];
            const isTableRow = line.trim().match(/^\|.*\|$/);

            if (isTableRow) {
                let tableLines = [];
                let separatorSeen = false;

                while (i < lines.length && lines[i].trim().match(/^\|.*\|$/)) {
                    const row = lines[i].trim();
                    if (row.includes('---')) {
                        separatorSeen = true;
                        i++;
                        continue;
                    }
                    tableLines.push(row);
                    i++;
                }

                if (separatorSeen && tableLines.length > 0) {
                    result.push('<table>');
                    tableLines.forEach(rowLine => {
                        const cells = rowLine.split('|').filter(c => c.trim() !== '');
                        const cellTags = cells.map(cell => `<td>${cell.trim()}</td>`).join('');
                        result.push(`<tr>${cellTags}</tr>`);
                    });
                    result.push('</table>');
                } else {
                    result.push(...tableLines);
                }
            } else {
                result.push(line);
                i++;
            }
        }

        return result.join('\n');
    }

    /**
     * Process headers (h1-h6)
     */
    static processHeaders(formatted) {
        formatted = formatted.replace(/^(?! {4})###### (.*$)/gm, '<h6>$1</h6>');
        formatted = formatted.replace(/^(?! {4})##### (.*$)/gm, '<h5>$1</h5>');
        formatted = formatted.replace(/^(?! {4})#### (.*$)/gm, '<h4>$1</h4>');
        formatted = formatted.replace(/^(?! {4})### (.*$)/gm, '<h3>$1</h3>');
        formatted = formatted.replace(/^(?! {4})## (.*$)/gm, '<h2>$1</h2>');
        formatted = formatted.replace(/^(?! {4})# (.*$)/gm, '<h1>$1</h1>');
        return formatted;
    }

    /**
     * Process bold and italic
     */
    static processBoldItalic(formatted) {
        // Format bold
        formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        // Format italic
        formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
        return formatted;
    }

    /**
     * Process horizontal rules
     */
    static processHorizontalRules(formatted) {
        return formatted.replace(/^(?!.*\|)(?!.*<tr)(?!.*<pre)(?!.*<code)---$/gm, '<hr>');
    }

    /**
     * Process blockquotes
     */
    static processBlockquotes(formatted) {
        const blockquoteLines = formatted.split('\n');
        let blockquoteResult = [];
        let inBlockquote = false;
        let blockquoteContent = [];

        for (let line of blockquoteLines) {
            const isBlockquote = /^>\s+(.*)/.test(line);

            if (isBlockquote) {
                const content = line.replace(/^>\s+/, '');
                blockquoteContent.push(content);
                inBlockquote = true;
            } else {
                if (inBlockquote) {
                    blockquoteResult.push(`<blockquote>${blockquoteContent.join('<br>')}</blockquote>`);
                    blockquoteContent = [];
                    inBlockquote = false;
                }
                blockquoteResult.push(line);
            }
        }

        if (inBlockquote) {
            blockquoteResult.push(`<blockquote>${blockquoteContent.join('<br>')}</blockquote>`);
        }

        return blockquoteResult.join('\n');
    }

    /**
     * Process lists (both ordered and unordered)
     */
    static processLists(formatted) {
        const listLines = formatted.split('\n');
        let listResult = [];
        let listIdx = 0;

        while (listIdx < listLines.length) {
            const line = listLines[listIdx];
            const isUlItem = /^[\-\*]\s+(.*)/.test(line);
            const isOlItem = /^\d+\.\s+(.*)/.test(line);

            if (isUlItem || isOlItem) {
                const currentListType = isUlItem ? 'ul' : 'ol';
                const listItems = [];

                while (listIdx < listLines.length) {
                    const listLine = listLines[listIdx];
                    const isListItemUl = /^[\-\*]\s+(.*)/.test(listLine);
                    const isListItemOl = /^\d+\.\s+(.*)/.exec(listLine);

                    if (isListItemUl) {
                        const itemContent = listLine.replace(/^[\-\*]\s+/, '');
                        listItems.push(`<li>${itemContent}</li>`);
                        listIdx++;
                    } else if (isListItemOl) {
                        // Preserve the original number from markdown
                        const number = isListItemOl[1];
                        const marker = listLine.match(/^\d+\./)[0];
                        listItems.push(`<li><span class="list-number">${marker}</span> ${number}</li>`);
                        listIdx++;
                    } else if (listLine.trim() === '') {
                        listIdx++;
                    } else {
                        break;
                    }
                }

                // Join list items without newlines
                listResult.push(`<${currentListType}>${listItems.join('')}</${currentListType}>`);
            } else {
                listResult.push(line);
                listIdx++;
            }
        }

        return listResult.join('\n\n');
    }

    /**
     * Process links (URLs)
     */
    static processLinks(formatted) {
        return formatted.replace(/(^|\s)(https?:\/\/[^\s<]+|www\.[^\s<]+)/gi, (match, prefix, url) => {
            const cleanUrl = url.replace(/[.,;:!?)\]]+$/, '');
            const fullUrl = cleanUrl.startsWith('www.') ? 'https://' + cleanUrl : cleanUrl;

            let displayUrl = cleanUrl;
            try {
                const urlObj = new URL(fullUrl);
                if (cleanUrl.length > 50) {
                    displayUrl = urlObj.hostname + '/...';
                }
            } catch (e) {
                // Invalid URL, use as-is
            }

            return `${prefix}<a href="${fullUrl}" target="_blank" rel="noopener noreferrer" class="message-link">${displayUrl}</a>`;
        });
    }

    /**
     * Process paragraphs
     */
    static processParagraphs(formatted) {
        let paragraphs = formatted.split(/\n\n/);
        let processedParagraphs = [];
        let paraIdx = 0;

        while (paraIdx < paragraphs.length) {
            const para = paragraphs[paraIdx];

            // If this paragraph starts with an unclosed list tag, find the closing tag
            if ((para.startsWith('<ul>') || para.startsWith('<ol>')) && !para.includes('</ul>') && !para.includes('</ol>')) {
                let combined = para;
                paraIdx++;
                while (paraIdx < paragraphs.length && !combined.includes('</ul>') && !combined.includes('</ol>')) {
                    combined += '\n\n' + paragraphs[paraIdx];
                    paraIdx++;
                }
                processedParagraphs.push(combined);
            } else if (!para.trim()) {
                paraIdx++;
            } else {
                processedParagraphs.push(para);
                paraIdx++;
            }
        }

        paragraphs = processedParagraphs.map(para => {
            // Skip if this is already HTML
            if (para.match(/^(<[huol]|<pre|<li|<table|<blockquote)/)) {
                return para;
            }

            // Preserve leading indentation for code blocks
            if (para.match(/^(    |\t)/m)) {
                const lines = para.split('\n');
                const trimmedLines = lines.map(line => line.replace(/^    /, ''));
                return `<pre style="white-space: pre-wrap;">${trimmedLines.join('\n')}</pre>`;
            }

            // Regular paragraph - convert single line breaks to <br>
            return `<p>${para.replace(/\n/g, '<br>')}</p>`;
        });

        return paragraphs.filter(p => p).join('\n');
    }
}
