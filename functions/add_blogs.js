const admin = require('firebase-admin');
admin.initializeApp();

const db = admin.firestore();

const blogs = [
  {
    title: "5 Strategies to Boost Your Adobe Stock Sales in 2026",
    category: "Microstock",
    imageUrl: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&q=80&w=800",
    content: "<h3>The Changing Landscape of Microstock</h3><p>In 2026, AI-generated content is everywhere, but authentic, high-quality human photography and highly-curated AI assets are performing better than ever. Here are 5 strategies to maximize your Adobe Stock revenue this year.</p><br><ul><li><strong>Focus on Niche Concepts:</strong> Instead of generic business handshakes, focus on emerging technologies and specific lifestyle trends.</li><li><strong>Perfect Your Metadata:</strong> Using AI Metadata generators like DesignInk can save hours while improving search relevance.</li><li><strong>Upload Consistently:</strong> The algorithm favors active portfolios.</li></ul><br><p>By adapting to these trends, you can secure your spot in the top 10% of contributors.</p>",
    author: "Sithija",
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  },
  {
    title: "Why Metadata is the Secret Weapon for Graphic Designers",
    category: "Graphic Design",
    imageUrl: "https://images.unsplash.com/photo-1626785774573-4b799315345d?auto=format&fit=crop&q=80&w=800",
    content: "<h3>Stop Leaving Money on the Table</h3><p>Many graphic designers spend hours creating the perfect vector or illustration, only to spend 30 seconds on the title and keywords. This is the biggest mistake you can make.</p><br><p>Metadata is how search engines and buyers find your work. A perfectly designed logo template will never sell if it is tagged poorly. Always aim for at least 35 highly relevant keywords, focusing on conceptual terms as well as literal ones. <strong>Conceptual keywords</strong> like 'innovation', 'teamwork', and 'success' often drive more sales than literal descriptions.</p>",
    author: "Sithija",
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  },
  {
    title: "The Ultimate Workflow for Bulk Generating AI Art",
    category: "AI Tools",
    imageUrl: "https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&q=80&w=800",
    content: "<h3>Scaling Your AI Portfolio</h3><p>Generating one image at a time on Midjourney is great for learning, but terrible for building a microstock portfolio. To succeed, you need volume and quality.</p><br><p>Using prompt engineering tools to build CSV files of detailed prompts allows you to automate the generation process. Focus on structuring your prompts with consistent camera angles, lighting, and style keywords. Once you have a winning prompt structure, you can iterate it hundreds of times to build a cohesive collection that buyers will love.</p>",
    author: "Sithija",
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  }
];

async function addData() {
  try {
    for (const blog of blogs) {
      await db.collection('blogs').add(blog);
      console.log('Added blog:', blog.title);
    }
    console.log('Done!');
    process.exit(0);
  } catch (err) {
    console.error('Error adding blogs:', err);
    process.exit(1);
  }
}

addData();
