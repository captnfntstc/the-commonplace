async function verifyArtistPhotos() {
  const list = [
    { name: 'Taylor Swift', url: 'https://upload.wikimedia.org/wikipedia/commons/6/68/Glasto2025-546_%28cropped%29_2.jpg' },
    { name: 'Olivia Rodrigo', url: 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/08/9e/07/089e0799-b405-9e69-b648-e6a19df9879c/24UMGIM30485.rgb.jpg/1000x1000bb.jpg' },
    { name: 'Noah Kahan', url: 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/e4/75/f3/e475f31a-ade1-50bf-e983-1467aaf62c46/23UMGIM59938.rgb.jpg/1000x1000bb.jpg' },
    { name: 'Hollow Coves', url: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/1d/8d/ed/1d8ded31-05c8-64d0-57ff-93bd93f7d491/067003150354.png/1000x1000bb.jpg' }
  ];

  for (const item of list) {
    const res = await fetch(item.url, { method: 'HEAD' });
    console.log(item.name, '-> status', res.status);
  }
}
verifyArtistPhotos();
