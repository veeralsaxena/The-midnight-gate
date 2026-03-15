require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const redis = require('../redis/client');
const { GoogleGenAI } = require('@google/genai');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const products = [
  {
    id: 1,
    title: "The Midnight Gate Limited Edition Jacket",
    description: "A highly sought-after, ultra-limited cyberpunk-style techwear jacket with luminescent threading and reactive nanocoating. Onyx black base with neon blue accents. Engineered for urban survival.",
    image: "/products/jacket.jpg", // Mock path
    price: 299.99
  },
  {
    id: 2,
    title: "Neon City Windbreaker",
    description: "Lightweight, breathable techwear windbreaker featuring reflective geometric patterns. Perfect for rainy nights. Dark grey base with subtle iridescent purple detailing.",
    image: "/products/windbreaker.jpg",
    price: 149.99
  },
  {
    id: 3,
    title: "Cybernetic Horizon Poster",
    description: "A high-quality art print depicting a sprawling futuristic metropolis under a crimson sky. Holographic foil accents. Dimensions: 24x36 inches.",
    image: "/products/poster.jpg",
    price: 49.99
  },
  {
    id: 4,
    title: "Quantum Stealth Hoodie",
    description: "A heavyweight pullover hoodie with an oversized cowl neck and integrated face shield. Advanced thermal regulation fabric. Pure obsidian black.",
    image: "/products/hoodie.jpg",
    price: 129.99
  },
  {
    id: 5,
    title: "Midnight Gate Collector's Pin",
    description: "Enamel pin set featuring the iconic Midnight Gate logo and cyber-skull motif. Glows in the dark. A subtle way to show you were there.",
    image: "/products/pin.jpg",
    price: 19.99
  }
];

function float32Buffer(arr) {
  return Buffer.from(new Float32Array(arr).buffer);
}

async function seedProducts() {
  console.log('🌱 Starting Vector DB Seeding...');

  // 1. Drop existing index if it exists
  try {
    await redis.call('FT.DROPINDEX', 'idx:products');
    console.log('🗑️  Dropped existing index idx:products');
  } catch (e) {
    if (!e.message.includes('Unknown Index name')) {
       console.log('Index drop bypassed (may not exist).');
    }
  }

  // 2. Create the RediSearch Vector Index
  console.log('🏗️  Creating Vector Index schema...');
  try {
    await redis.call(
      'FT.CREATE',
      'idx:products',
      'ON', 'HASH',
      'PREFIX', '1', 'product_data:',
      'SCHEMA',
      'title', 'TEXT',
      'description', 'TEXT',
      'embedding', 'VECTOR', 'FLAT', '6', 'TYPE', 'FLOAT32', 'DIM', '768', 'DISTANCE_METRIC', 'COSINE'
    );
    console.log('✅ Index created: idx:products');
  } catch (e) {
    console.error('❌ Error creating index:', e.message);
    process.exit(1);
  }

  // 3. Generate Embeddings & Store in Redis Hash
  console.log('🧠 Generating Gemini Embeddings for products...');
  for (const product of products) {
    let embeddingArr;
    try {
      const textToEmbed = `${product.title}. ${product.description}`;
      const response = await ai.models.embedContent({
        model: 'text-embedding-004',
        contents: textToEmbed
      });
      embeddingArr = response.embeddings[0].values;
    } catch (apiError) {
      console.warn(`⚠️ Warning: Gemini API failed for Product ${product.id}. Falling back to pseudo-random 768d vector for hackathon demo. (${apiError.message})`);
      // Fallback: Generate a normalized 768-dimensional float32 vector
      embeddingArr = new Array(768).fill(0).map(() => Math.random() - 0.5);
      const magnitude = Math.sqrt(embeddingArr.reduce((sum, val) => sum + val * val, 0));
      embeddingArr = embeddingArr.map(val => val / magnitude);
    }

    try {
      const embeddingBuffer = float32Buffer(embeddingArr);

      // Save product hash
      await redis.hset(
        `product_data:${product.id}`,
        'id', product.id.toString(),
        'title', product.title,
        'description', product.description,
        'image', product.image,
        'price', product.price.toString(),
        'embedding', embeddingBuffer
      );

      // Initialize atomic inventory (stock) counter if not exists for 2-5
      // Product 1 stock is handled by the regular reset/startup flow
      if (product.id !== 1) {
         await redis.set(`product:${product.id}:inventory`, 50); // Fallback items have plenty of stock
      }

      console.log(`✅ Stored product & vector: [${product.id}] ${product.title}`);
    } catch (e) {
      console.error(`❌ Error embedding product ${product.id}:`, e.message);
    }
  }

  console.log('🎉 Seeding Complete!');
  process.exit(0);
}

seedProducts();
