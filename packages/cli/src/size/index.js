import fs from 'fs'
import { globSync } from 'glob'
console.log('\x1b[32m', '\rAssets analyse')
const imgList = globSync('./**/*.{webp,svg}')

if (imgList.length === 0) {
  console.log('\nNothing find!')
}

function bytesToSize(bytes, decimals = 2) {
  if (!Number(bytes)) {
    return '0 Bytes'
  }

  const kbToBytes = 1000
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']

  const index = Math.floor(Math.log(bytes) / Math.log(kbToBytes))

  return `${parseFloat((bytes / kbToBytes ** index).toFixed(dm))} ${sizes[index]}`
}

let result = ''
for (let i = 0; i < imgList.length; i++) {
  const imgPath = imgList[i]
  const size = fs.statSync(imgPath).size
  if (size > 400000 && !/-animation.webp$/.test(imgPath)) {
    result = `${result}
      🐢 ${bytesToSize(size)}  🗺️ ${imgPath}
    `
  }
}
if (result.length > 0) {
  console.log('\x1b[0m', '')
  throw result
}

console.log('\x1b[0m', '')
