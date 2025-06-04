// scrapers/chatgpt.js

function convertLatex(content) {
    let processed = content.replace(/\\\\$$ (.*?)\\\\ $$/g, (_, eq) => `$${eq}$`);
    processed = processed.replace(/\\\\$$ (.*?)\\\ $$/gs, (_, eq) => `$$$${eq}$$$`);
    processed = processed.replace(/\\"/g, '"');
    return processed;
  }
  
  function parseContent(content) {
    const CODE_BLOCK_REGEX = /```([^\s]*)([\s\S]*?)```/g;
    const parts = [];
    let lastIndex = 0;
    let match;
  
    while ((match = CODE_BLOCK_REGEX.exec(content)) !== null) {
      const [fullMatch, lang, code] = match;
      const offset = match.index;
  
      if (offset > lastIndex) {
        const text = content.slice(lastIndex, offset).replace(/\\n/g, '\n').trim();
        if (text) {
          parts.push({ type: 'text', data: convertLatex(text) });
        }
      }
  
      parts.push({
        type: 'code',
        language: lang.trim() || 'plaintext',
        data: code.trim().replace(/\\n/g, '\n')
      });
  
      lastIndex = offset + fullMatch.length;
    }
  
    if (lastIndex < content.length) {
      const text = content.slice(lastIndex).replace(/\\n/g, '\n').trim();
      if (text) {
        parts.push({ type: 'text', data: convertLatex(text) });
      }
    }
  
    return parts;
  }
  
  function domToMarkdown(element) {
    let markdown = '';
    
    for (const node of element.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        markdown += node.textContent.trim();
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        switch (node.tagName.toLowerCase()) {
          case 'h1': markdown += `# ${node.textContent.trim()}\n`; break;
          case 'h2': markdown += `## ${node.textContent.trim()}\n`; break;
          case 'h3': markdown += `### ${node.textContent.trim()}\n`; break;
          case 'p': markdown += `${node.textContent.trim()}\n`; break;
          case 'pre': 
            const code = node.querySelector('code');
            const lang = code?.className.match(/language-([a-zA-Z0-9]+)/)?.[1] || '';
            markdown += `\`\`\`${lang}\n${code ? code.textContent.trim() : node.textContent.trim()}\n\`\`\`\n`; 
            break;
          case 'table':
            const rows = Array.from(node.querySelectorAll('tr'));
            rows.forEach((row, index) => {
              const cells = Array.from(row.children).map(cell => cell.textContent.trim());
              markdown += `| ${cells.join(' | ')} |\n`;
              if (index === 0) {
                markdown += `| ${cells.map(() => '---').join(' | ')} |\n`;
              }
            });
            break;
          case 'ul':
            node.querySelectorAll('li').forEach(li => {
              markdown += `- ${li.textContent.trim()}\n`;
            });
            break;
          case 'ol':
            node.querySelectorAll('li').forEach((li, i) => {
              markdown += `${i + 1}. ${li.textContent.trim()}\n`;
            });
            break;
          case 'span':
            if (node.classList.contains('katex')) {
              markdown += convertLatex(node.textContent.trim());
            } else {
              markdown += node.textContent.trim();
            }
            break;
          default:
            markdown += node.textContent.trim();
        }
      }
    }
    
    return markdown.trim();
  }
  
  async function scrapeChatGPT() {
    const conversationId = generateConversationId();
    const conversationTitle = document.title || "Untitled Conversation";
  
    const conversation = {
      conversation_id: conversationId,
      conversation_title: conversationTitle,
      messages: []
    };
  
    try {
      const messageDivs = document.querySelectorAll("div[data-message-author-role='user'], div[data-message-author-role='assistant']");
      
      if (messageDivs.length > 0) {
        messageDivs.forEach(div => {
          const role = div.getAttribute("data-message-author-role");
          let contentElement = div.querySelector(".whitespace-pre-wrap, .markdown") || div;
          const markdownContent = domToMarkdown(contentElement);
          const contentBlocks = parseContent(markdownContent);
  
          if (contentBlocks.length > 0) {
            conversation.messages.push({
              role: role,
              create_time: Date.now(),
              content: contentBlocks,
              timestamp: new Date().toISOString()
            });
          }
        });
      } else {
        const turns = document.querySelectorAll("[data-testid^='conversation-turn']");
        turns.forEach(turn => {
          let role = turn.getAttribute("data-message-author-role") || (Array.from(turns).indexOf(turn) % 2 === 0 ? "user" : "assistant");
          let contentElement = turn.querySelector(".whitespace-pre-wrap, .markdown") || turn;
          const markdownContent = domToMarkdown(contentElement);
          const contentBlocks = parseContent(markdownContent);
  
          if (contentBlocks.length > 0) {
            conversation.messages.push({
              role: role,
              create_time: Date.now(),
              content: contentBlocks,
              timestamp: new Date().toISOString()
            });
          }
        });
      }
  
      if (conversation.messages.length === 0) {
        const htmlContent = document.documentElement.outerHTML;
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlContent, 'text/html');
        const scriptTags = Array.from(doc.querySelectorAll('script'));
  
        scriptTags.forEach(script => {
          const scriptText = script.textContent;
          if (scriptText.includes('parts":[')) {
            const messageRegex = /"id":"(.*?)".*?"role":"(user|assistant)".*?"create_time":(.*?),.*?"parts":$$ "(.*?)" $$/gs;
            let match;
            
            while ((match = messageRegex.exec(scriptText)) !== null) {
              const content = match[4];
              const parsedContent = parseContent(content);
  
              conversation.messages.push({
                role: match[2],
                create_time: parseFloat(match[3]),
                content: parsedContent,
                timestamp: new Date(parseFloat(match[3]) * 1000).toISOString()
              });
            }
          }
        });
      }
  
      return conversation;
    } catch (error) {
      console.error('Error scraping ChatGPT:', error);
      return { error: 'Failed to scrape ChatGPT conversation' };
    }
  }