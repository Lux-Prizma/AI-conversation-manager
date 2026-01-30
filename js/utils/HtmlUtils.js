/**
 * HTML Utility Functions
 */

export class HtmlUtils {
    /**
     * Escape HTML special characters to prevent XSS
     * Only escapes truly dangerous characters: &, <, >, "
     * Preserves quotes and apostrophes for readability
     */
    static escapeHtml(text) {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    /**
     * Escape special regex characters
     */
    static escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    /**
     * Strip HTML tags from content
     */
    static stripHtml(html) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        return tempDiv.textContent || tempDiv.innerText || '';
    }

    /**
     * Truncate text to max length
     */
    static truncate(text, maxLength) {
        if (text.length <= maxLength) {
            return text;
        }
        return text.substring(0, maxLength) + '...';
    }
}
