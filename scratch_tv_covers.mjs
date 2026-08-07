async function testRedTV() {
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent("Taylor Swift Red Taylor's Version")}&entity=album&limit=50`;
  const res = await fetch(url);
  if (res.ok) {
    const data = await res.json();
    const matches = data.results.filter((a) => a.collectionName.toLowerCase().startsWith('red'));
    for (const m of matches) {
      console.log(m.collectionName, '(', m.releaseDate?.slice(0,4), ')');
      console.log('  URL:', m.artworkUrl100.replace('/100x100bb.jpg', '/1000x1000bb.jpg'));
    }
  }
}
testRedTV();
