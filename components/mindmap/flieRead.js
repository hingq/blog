import { randomString } from './randomChar'
/**
 *
 * @param {File} file
 * @returns
 */
export default function read(file) {
  if (file) {
    return readFile(file).then((res) => {
      const context = splitString(res)
      const ctx = toJson(context)
      return ctx
    })
  }
}
// convert children to json
function tojson_content(ctx, root) {
  if (!ctx) return {}
  const mind = []
  let i = 0
  let obj
  while (i < ctx.length) {
    const { type: type, text: context } = ctx[i]
    const title = randomString()
    if (context) {
      obj = {
        id: `${type}_${title}`,
        topic: context.split('\n').join('').trim(),
        parentid: root,
        direction: Math.random() > 0.5 ? 'left' : 'right',
        expanded: Math.random() > 0.5 ? true : false,
      }
      mind.push(obj)
    }
    i++
  }
  return mind
}
/**
 * @description convert context to json
 * @param {Array} ctx
 * @returns mind(array)
 */
function toJson(ctx) {
  if (!ctx) return
  const mind = []

  let i = 0
  let obj
  let j
  while (i < ctx.length) {
    const { type: P_type, title, content: context } = ctx[i]
    obj = {
      id: `${P_type}_${title}`,
      parentid: 'root',
      topic: title,
      direction: Math.random() > 0.5 ? 'left' : 'right',
      expanded: Math.random() > 0.5 ? true : false,
    }
    mind.push(obj)
    mind.push(...tojson_content(parseMd(context), `${P_type}_${title}`))
    j = i + 1

    while (j < ctx.length && ctx[j].type > P_type) {
      const { type: type1, title: title1, content: content1 } = ctx[j]
      const con1 = parseMd(content1)
      mind.push({
        id: `${type1}_${title1}`,
        parentid: `${P_type}_${title}`,
        topic: title1,
        direction: Math.random() > 0.5 ? 'left' : 'right',
        expanded: Math.random() > 0.5 ? true : false,
      })

      mind.push(...tojson_content(con1, `${type1}_${title1}`))
      // 结构赋值，
      j++
    }
    i = j
  }
  return mind
}

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = function (e) {
      resolve(e.target.result)
    }
    reader.onerror = function (e) {
      reject(e)
    }
    reader.readAsText(file)
  })
}
/**
 *
 * @param {String} str
 * @description format string
 * @returns array
 */

function parseMd(str) {
  if (!str) return []
  const lines = str.split('\n')
  const json = []
  let currentList = null
  let p = null
  let inCodeBlock = null
  let codeBlock = ''
  lines.forEach((l) => {
    let match = null
    if (l.trim().startsWith('```')) {
      // code
      if (inCodeBlock) {
        json.push({ type: 'code', text: codeBlock.trim() })
        codeBlock = ''
      }
      inCodeBlock = !inCodeBlock
      currentList = null
      return
    }

    if (inCodeBlock) {
      codeBlock += l + '\n'
      return
    } else if ((match = l.match(/^-\s+(.*)/))) {
      // ul
      if (!currentList || currentList.type !== 'ul') {
        currentList = { type: 'ul', item: [] }
        json.push(currentList)
      }
      currentList.item.push({ type: 'li', text: match[1] })
    } else if ((match = l.match(/^\d+\.\s+(.*)/))) {
      // ol
      if (!currentList || currentList.type !== 'ol') {
        currentList = { type: 'ol', items: [] }
        json.push(currentList)
      }
      currentList.items.push({ type: 'li', text: match[1] })
      // currentParagraph = null;
    } else if ((match = l.match(/^>\s+(.*)/))) {
      json.push({ type: 'blockquote', text: match[1] })
    } else if (l.match('^---+$')) {
      json.push({ type: 'hr' })
    } else if (l.trim() === '') {
      return
    } else {
      if (!p) {
        p = { type: 'p', text: l.trim() }
        json.push(p)
      }
    }
  })

  return json
}

// spilt text with '#{1,6}',addtionally,don't use '#' in a code snippet(python),which will make the the function make mistakes
// or replace it with null
function splitString(str) {
  // replace # in code
  // const reg_code = /```(?:[\s\S]+?)```/gm;

  // spilt by '#'
  const regex = /(?=^#{1,6})(((.*[\s\S]*?)(?=\n^#{1,6}))|([\s\S]+))/gm
  const match = str.match(regex)

  // get title and content
  const regex2 = /#{1,6}(.*)/gm
  const regex3 = /#{1,6}/
  const context = []

  // merge to obj
  match.forEach((item) => {
    const h = item.match(regex3)
    const t = item.match(regex2).toString().replace(h, '')
    context.push({
      type: `h${h.toString().length}`,
      title: t.trim(),
      content: item.replace(regex2, '').trim(),
    })
  })
  return context
}
