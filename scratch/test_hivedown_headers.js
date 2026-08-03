
async function test() {
    try {
        const url = 'https://www.tiktok.com/@mrbeast/video/7345634024843472170';
        const apiUrl = `https://api.imagetoolz.top/?url=${encodeURIComponent(url)}`;
        console.log('Testing HiveDown API with Browser Headers...');
        const response = await fetch(apiUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Accept': 'application/json'
            }
        });
        const text = await response.text();
        console.log('Status:', response.status);
        console.log('Body:', text.substring(0, 500));
    } catch (e) {
        console.error('Error:', e.message);
    }
}
test();
