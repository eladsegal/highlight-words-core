import * as Chunks from './utils.js'
import expect from 'expect.js'
import latinize from 'latinize'

describe('utils', () => {
  // Positions: 01234567890123456789012345678901234567
  const TEXT = 'This is a string with words to search.'

  it('should handle empty or null textToHighlight', () => {
    let result = Chunks.findAll({
      searchWords: ['search'],
      textToHighlight: ''
    })
    expect(result.length).to.equal(0)

    result = Chunks.findAll({
      searchWords: ['search']
    })
    expect(result.length).to.equal(0)
  })

  it('should highlight all occurrences of a word, regardless of capitalization', () => {
    const rawChunks = Chunks.findChunks({
      searchWords: ['th'],
      textToHighlight: TEXT
    })
    expect(rawChunks).to.eql([
      {start: 0, end: 2, highlight: false},
      {start: 19, end: 21, highlight: false}
    ])
  })

  it('should highlight words that partially overlap', () => {
    const combinedChunks = Chunks.combineChunks({
      chunks: Chunks.findChunks({
        searchWords: ['thi', 'is'],
        textToHighlight: TEXT
      })
    })
    expect(combinedChunks).to.eql([
      {start: 0, end: 4, highlight: false},
      {start: 5, end: 7, highlight: false}
    ])
  })

  it('should combine into the minimum number of marked and unmarked chunks', () => {
    const filledInChunks = Chunks.findAll({
      searchWords: ['thi', 'is'],
      textToHighlight: TEXT
    })
    expect(filledInChunks).to.eql([
      {start: 0, end: 4, highlight: true},
      {start: 4, end: 5, highlight: false},
      {start: 5, end: 7, highlight: true},
      {start: 7, end: 38, highlight: false}
    ])
  })

  it('should combine into the maximum number of marked and unmarked chunks', () => {
    const filledInChunks = Chunks.findAll({
      searchWords: ['Tom', 'om Joh', 'Tom'],
      textToHighlight: 'Tom Johnson Tom test',
      splitIntersectingChunks: true 
    })
    expect(filledInChunks).to.eql([
      {start: 0, end: 1, highlight: true, searchWordsIndexes: [0, 2]},
      {start: 1, end: 3, highlight: true, searchWordsIndexes: [0, 1, 2]},
      {start: 3, end: 7, highlight: true, searchWordsIndexes: [1]},
      {start: 7, end: 12, highlight: false},
      {start: 12, end: 15, highlight: true, searchWordsIndexes: [0, 2]},
      {start: 15, end: 20, highlight: false},
    ])
  })


  it('should combine into the maximum number of marked and unmarked chunks, with spans considred', () => {
    const filledInChunks = Chunks.findAll({
      searchWords: ['Tom', 'om Joh', 'Tom'],
      textToHighlight: 'Tom Johnson Tom test',
      spans: [[0, 1], [16, 17], [4,8]],
      splitIntersectingChunks: true 
    })
    expect(filledInChunks).to.eql([
      {start: 0, end: 1, highlight: true, searchWordsIndexes: [0, 2], spansIndexes: [0]},
      {start: 1, end: 3, highlight: true, searchWordsIndexes: [0, 1, 2]},
      {start: 3, end: 4, highlight: true, searchWordsIndexes: [1]},
      {start: 4, end: 7, highlight: true, searchWordsIndexes: [1], spansIndexes: [2]},
      {start: 7, end: 8, highlight: true, spansIndexes: [2]},
      {start: 8, end: 12, highlight: false},
      {start: 12, end: 15, highlight: true, searchWordsIndexes: [0, 2]},
      {start: 15, end: 16, highlight: false},
      {start: 16, end: 17, highlight: true, spansIndexes: [1]},
      {start: 17, end: 20, highlight: false},
    ])
  })

  it('should combine into the maximum number of marked and unmarked chunks, with only spans', () => {
    const filledInChunks = Chunks.findAll({
      searchWords: [],
      textToHighlight: 'Tom Johnson Tom test',
      spans: [[0, 1], [3,7], [5,9], [16, 17]],
      splitIntersectingChunks: true 
    })
    expect(filledInChunks).to.eql([
      {start: 0, end: 1, highlight: true, spansIndexes: [0]},
      {start: 1, end: 3, highlight: false},
      {start: 3, end: 5, highlight: true, spansIndexes: [1]},
      {start: 5, end: 7, highlight: true, spansIndexes: [1, 2]},
      {start: 7, end: 9, highlight: true, spansIndexes: [2]},
      {start: 9, end: 16, highlight: false},
      {start: 16, end: 17, highlight: true, spansIndexes: [3]},
      {start: 17, end: 20, highlight: false},
    ])
  })

  it('should handle unclosed parentheses when autoEscape prop is truthy', () => {
    const rawChunks = Chunks.findChunks({
      autoEscape: true,
      searchWords: ['text)'],
      textToHighlight: '(This is text)'
    })
    expect(rawChunks).to.eql([
      {start: 9, end: 14, highlight: false}
    ])
  })

  it('should match terms without accents against text with accents', () => {
    const rawChunks = Chunks.findChunks({
      sanitize: latinize,
      searchWords: ['example'],
      textToHighlight: 'ỆᶍǍᶆṔƚÉ'
    })
    expect(rawChunks).to.eql([
      {start: 0, end: 7, highlight: false}
    ])
  })

  it('should support case sensitive matches', () => {
    let rawChunks = Chunks.findChunks({
      caseSensitive: true,
      searchWords: ['t'],
      textToHighlight: TEXT
    })
    expect(rawChunks).to.eql([
      {start: 11, end: 12, highlight: false},
      {start: 19, end: 20, highlight: false},
      {start: 28, end: 29, highlight: false}
    ])

    rawChunks = Chunks.findChunks({
      caseSensitive: true,
      searchWords: ['T'],
      textToHighlight: TEXT
    })
    expect(rawChunks).to.eql([
      {start: 0, end: 1, highlight: false}
    ])
  })

  it('should handle zero-length matches correctly', () => {
    let rawChunks = Chunks.findChunks({
      caseSensitive: true,
      searchWords: ['.*'],
      textToHighlight: TEXT
    })
    expect(rawChunks).to.eql([
        {start: 0, end: 38, highlight: false}
    ])

    rawChunks = Chunks.findChunks({
      caseSensitive: true,
      searchWords: ['w?'],
      textToHighlight: TEXT
    })
    expect(rawChunks).to.eql([
        {start: 17, end: 18, highlight: false},
        {start: 22, end: 23, highlight: false}
    ])
  })

  it('should use custom findChunks', () => {
    let filledInChunks = Chunks.findAll({
      findChunks: () => (
       [{start: 1, end: 3}]
      ),
      searchWords: ['xxx'],
      textToHighlight: TEXT
    })
    expect(filledInChunks).to.eql([
      {start: 0, end: 1, highlight: false},
      {start: 1, end: 3, highlight: true},
      {start: 3, end: 38, highlight: false}
    ])

    filledInChunks = Chunks.findAll({
      findChunks: () => (
       []
      ),
      searchWords: ['This'],
      textToHighlight: TEXT
    })
    expect(filledInChunks).to.eql([
      {start: 0, end: 38, highlight: false}
    ])
  })
})
