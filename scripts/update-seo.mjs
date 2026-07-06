import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, '..');
const gamesDir = path.join(rootDir, 'games');

function parseMeta(content) {
  const getField = (fieldName) => {
    // Matches field: 'value', field: "value", field: `value` spanning multiple lines
    const regex = new RegExp(`${fieldName}\\s*:\\s*(["'\`])([\\s\\S]*?)\\1`, 'm');
    const match = content.match(regex);
    if (match) {
      return match[2].replace(/\s+/g, ' ').trim();
    }
    return null;
  };

  const title = getField('title');
  const description = getField('description');
  return { title, description };
}

function updateSeoTags(htmlContent, gameId, title, description) {
  const cleanTitle = `${title} - JUEGACHOS`;
  const cleanDesc = description;
  const gameUrl = `https://www.juegachos.com/games/${gameId}/`;
  const imageUrl = `https://www.juegachos.com/covers/${gameId}.jpg`;

  const seoBlock = `<!-- SEO TAGS -->
    <title>${cleanTitle}</title>
    <meta name="description" content="${cleanDesc}" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${cleanTitle}" />
    <meta property="og:description" content="${cleanDesc}" />
    <meta property="og:image" content="${imageUrl}" />
    <meta property="og:url" content="${gameUrl}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${cleanTitle}" />
    <meta name="twitter:description" content="${cleanDesc}" />
    <meta name="twitter:image" content="${imageUrl}" />
    <!-- END SEO TAGS -->`;

  const seoBlockRegex = /<!-- SEO TAGS -->[\s\S]*?<!-- END SEO TAGS -->/;
  if (seoBlockRegex.test(htmlContent)) {
    return htmlContent.replace(seoBlockRegex, seoBlock);
  }

  // Fallback: replace the title tag if SEO tags block doesn't exist
  const titleRegex = /<title>.*?<\/title>/;
  if (titleRegex.test(htmlContent)) {
    return htmlContent.replace(titleRegex, seoBlock);
  }

  // If no title tag, put it inside <head> after first match
  const headRegex = /<head>/;
  if (headRegex.test(htmlContent)) {
    return htmlContent.replace(headRegex, `<head>\n    ${seoBlock}`);
  }

  return htmlContent;
}

function main() {
  if (!fs.existsSync(gamesDir)) {
    console.error(`Games directory not found: ${gamesDir}`);
    process.exit(1);
  }

  const dirents = fs.readdirSync(gamesDir, { withFileTypes: true });
  let count = 0;

  for (const dirent of dirents) {
    if (!dirent.isDirectory()) continue;
    const gameId = dirent.name;
    const metaPath = path.join(rootDir, 'src', 'games', gameId, 'meta.ts');
    const htmlPath = path.join(gamesDir, gameId, 'index.html');

    if (!fs.existsSync(metaPath)) {
      console.warn(`[SEO Warning] meta.ts not found for game: ${gameId}`);
      continue;
    }
    if (!fs.existsSync(htmlPath)) {
      console.warn(`[SEO Warning] index.html not found for game: ${gameId}`);
      continue;
    }

    const metaContent = fs.readFileSync(metaPath, 'utf8');
    const { title, description } = parseMeta(metaContent);

    if (!title || !description) {
      console.warn(`[SEO Warning] Could not parse title/description for game: ${gameId}`);
      continue;
    }

    const htmlContent = fs.readFileSync(htmlPath, 'utf8');
    const updatedHtml = updateSeoTags(htmlContent, gameId, title, description);

    if (updatedHtml !== htmlContent) {
      fs.writeFileSync(htmlPath, updatedHtml, 'utf8');
      console.log(`[SEO Success] Updated metadata for: ${gameId}`);
      count++;
    } else {
      console.log(`[SEO No-Op] Already up to date: ${gameId}`);
    }
  }

  console.log(`SEO automation finished. Updated ${count} game files.`);
}

main();
