// @flow

export type Chunk = {|
  highlight: boolean,
  start: number,
  end: number,
  searchWordsIndexes?: Array<number>
|};

/**
 * Creates an array of chunk objects representing both higlightable and non highlightable pieces of text that match each search word.
 * @return Array of "chunks" (where a Chunk is { start:number, end:number, highlight:boolean })
 */
export const findAll = ({
  autoEscape,
  caseSensitive = false,
  findChunks = defaultFindChunks,
  sanitize,
  searchWords,
  textToHighlight,
  splitIntersectingChunks
}: {
  autoEscape?: boolean,
  caseSensitive?: boolean,
  findChunks?: typeof defaultFindChunks,
  sanitize?: typeof defaultSanitize,
  searchWords: Array<string>,
  textToHighlight: string,
  splitIntersectingChunks?: boolean
}): Array<Chunk> => (
  fillInChunks({
    chunksToHighlight: combineChunks({
      chunks: findChunks({
        autoEscape,
        caseSensitive,
        sanitize,
        searchWords,
        textToHighlight,
        splitIntersectingChunks
      }),
      splitIntersectingChunks
    }),
    totalLength: textToHighlight ? textToHighlight.length : 0
  })
)

/**
 * Takes an array of {start:number, end:number} objects and combines chunks that overlap into single chunks.
 * @return {start:number, end:number}[]
 */
export const combineChunks = ({
  chunks,
  splitIntersectingChunks
}: {
  chunks: Array<Chunk>,
  splitIntersectingChunks?: boolean
}): Array<Chunk> => {
  if (!splitIntersectingChunks) {
    chunks = chunks
      .sort((first, second) => first.start - second.start)
      .reduce((processedChunks, nextChunk) => {
        // First chunk just goes straight in the array...
        if (processedChunks.length === 0) {
          return [nextChunk]
        } else {
          // ... subsequent chunks get checked to see if they overlap...
          const prevChunk = processedChunks.pop()
          if (nextChunk.start <= prevChunk.end) {
            // It may be the case that prevChunk completely surrounds nextChunk, so take the
            // largest of the end indeces.
            const endIndex = Math.max(prevChunk.end, nextChunk.end)
            processedChunks.push({highlight: false, start: prevChunk.start, end: endIndex})
          } else {
            processedChunks.push(prevChunk, nextChunk)
          }
          return processedChunks
        }
      }, [])
  } else {
    const positions = ['start', 'end']
    const mappings = {}
    chunks.forEach((chunk) => {
      positions.forEach((position) => {
        mappings[chunk[position]] = mappings[chunk[position]] ? mappings[chunk[position]] : []

        if (chunk.searchWordsIndexes) {
          mappings[chunk[position]].push(`${chunk.searchWordsIndexes[0]}_${position}`)
        }
      })      
    })

    const intervalBoundaries = Object.keys(mappings).map(key => parseInt(key)).sort((firstKey, secondKey) => firstKey - secondKey)
    chunks = []
    let activeSearchWordsIndexes = []
    const activeIndexIndicatorToInteger = value => parseInt(value.substring(0, value.indexOf('_')))
    for (let i=0; i < intervalBoundaries.length - 1; i++) {
      const start = intervalBoundaries[i]
      const end = intervalBoundaries[i + 1]

      mappings[start]
        .filter(value => value.includes('end'))
        .map(activeIndexIndicatorToInteger)
        .forEach((searchWordIndex) => {
          const indexToRemove = activeSearchWordsIndexes.indexOf(searchWordIndex)
          activeSearchWordsIndexes.splice(indexToRemove, 1)
        })

      activeSearchWordsIndexes = activeSearchWordsIndexes
        .concat(mappings[start].filter(value => value.includes('start')).map(activeIndexIndicatorToInteger))
        .sort()

      if (activeSearchWordsIndexes.length > 0) {
        chunks.push({highlight: false, start: start, end: end, searchWordsIndexes: [...activeSearchWordsIndexes]});
      }
    }
  }
  return chunks
}

/**
 * Examine text for any matches.
 * If we find matches, add them to the returned array as a "chunk" object ({start:number, end:number}).
 * @return {start:number, end:number}[]
 */
const defaultFindChunks = ({
  autoEscape,
  caseSensitive,
  sanitize = defaultSanitize,
  searchWords,
  textToHighlight,
  splitIntersectingChunks
}: {
  autoEscape?: boolean,
  caseSensitive?: boolean,
  sanitize?: typeof defaultSanitize,
  searchWords: Array<string>,
  textToHighlight: string,
  splitIntersectingChunks?: boolean
}): Array<Chunk> => {
  textToHighlight = sanitize(textToHighlight)

  return searchWords
    .filter(searchWord => searchWord) // Remove empty words
    .reduce((chunks, searchWord, searchWordIndex) => {
      searchWord = sanitize(searchWord)

      if (autoEscape) {
        searchWord = escapeRegExpFn(searchWord)
      }

      const regex = new RegExp(searchWord, caseSensitive ? 'g' : 'gi')

      let match
      while ((match = regex.exec(textToHighlight))) {
        let start = match.index
        let end = regex.lastIndex
        // We do not return zero-length matches
        if (end > start) {
          const chunk = {highlight: false, start, end}
          if (splitIntersectingChunks) {
            chunk.searchWordsIndexes = [searchWordIndex]
          }
          chunks.push(chunk)
        }

        // Prevent browsers like Firefox from getting stuck in an infinite loop
        // See http://www.regexguru.com/2008/04/watch-out-for-zero-length-matches/
        if (match.index === regex.lastIndex) {
          regex.lastIndex++
        }
      }

      return chunks
    }, [])
}
// Allow the findChunks to be overridden in findAll,
// but for backwards compatibility we export as the old name
export {defaultFindChunks as findChunks}

/**
 * Given a set of chunks to highlight, create an additional set of chunks
 * to represent the bits of text between the highlighted text.
 * @param chunksToHighlight {start:number, end:number}[]
 * @param totalLength number
 * @return {start:number, end:number, highlight:boolean}[]
 */
export const fillInChunks = ({
  chunksToHighlight,
  totalLength
}: {
  chunksToHighlight: Array<Chunk>,
  totalLength: number,
}): Array<Chunk> => {
  const allChunks = []
  const append = (start, end, highlight, searchWordsIndexes) => {
    if (end - start > 0) {
      const chunk = {
        start,
        end,
        highlight
      }
      if (searchWordsIndexes) {
        chunk.searchWordsIndexes = searchWordsIndexes
      }
      allChunks.push(chunk)
    }
  }

  if (chunksToHighlight.length === 0) {
    append(0, totalLength, false)
  } else {
    let lastIndex = 0
    chunksToHighlight.forEach((chunk) => {
      append(lastIndex, chunk.start, false)
      append(chunk.start, chunk.end, true, chunk.searchWordsIndexes)
      lastIndex = chunk.end
    })
    append(lastIndex, totalLength, false)
  }
  return allChunks
}

function defaultSanitize (string: string): string {
  return string
}

function escapeRegExpFn (string: string): string {
  return string.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&')
}
