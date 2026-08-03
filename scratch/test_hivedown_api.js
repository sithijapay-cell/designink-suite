
async function test() {
    const url = 'https://youtu.be/kPMI-tpWEeI?si=xgRVog8RaAEMy3GZ';
    const mirror = 'https://cobalt.hyra.bot';
    console.log(`Testing mirror: ${mirror}`);
    try {
        const res = await fetch(`${mirror}?url=${encodeURIComponent(url)}`);
        console.log(`Status: ${res.status}`);
        const data = await res.json();
        console.log(`Data:`, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error(`Error: ${e.message}`);
    }
}
test();
