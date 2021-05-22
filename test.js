const test = require('tape')
const RAM = require('random-access-memory')
const Hypercore = require('hypercore')
const Hyperbee = require('hyperbee')
const HyperbeeDeeBee = require('./')
const { DB } = HyperbeeDeeBee

function getBee () {
  return new Hyperbee(new Hypercore(RAM))
}

test('Create a document in a collection', async (t) => {
  const db = new DB(getBee())
  try {
    const collection = db.collection('example')

    t.equal(collection.name, 'example', 'Collection created')

    const doc = await collection.insert({ example: 'Hello World!' })

    t.ok(doc?._id, 'Doc got created along with _id')

    const otherDoc = await collection.findOne({ _id: doc._id })

    t.equal(otherDoc.example, doc.example, 'DB property got loaded')

    t.end()
  } finally {
    await db.close()
  }
})

test('Iterate through all docs in a db', async (t) => {
  const db = new DB(getBee())

  try {
    const doc1 = await db.collection('example').insert({ example: 'Hello' })
    const doc2 = await db.collection('example').insert({ example: 'World' })

    const docs = await db.collection('example').find()

    t.equal(docs.length, 2, 'Found both docs')

    let isFirst = true
    for await (const doc of db.collection('example').find()) {
      if (isFirst) {
        t.ok(doc._id.equals(doc1._id), 'Got same id when iterating (1)')
        isFirst = false
      } else {
        t.ok(doc._id.equals(doc2._id), 'Got same id when iterating (2)')
      }
    }

    t.end()
  } finally {
    await db.close()
  }
})

test('Limit and Skip', async (t) => {
  const db = new DB(getBee())
  const NUM_TO_MAKE = 30
  let i = NUM_TO_MAKE
  try {
    while (i--) {
      await db.collection('example').insert({ i })
    }

    const found = await db
      .collection('example')
      .find()
      .skip(10)
      .limit(10)

    t.equal(found.length, 10, 'Got expected number of items')

    const onlyIs = found.map(({ i }) => i)

    const expected = [19, 18, 17, 16, 15, 14, 13, 12, 11, 10]

    t.deepEqual(onlyIs, expected, 'Got expected subset of Ids')

    t.end()
  } finally {
    await db.close()
  }
})

test('Search by field equal', async (t) => {
  const db = new DB(getBee())

  try {
    const doc1 = await db.collection('example').insert({ example: 'Hello' })
    const doc2 = await db.collection('example').insert({ example: ['Hello', 'World'] })
    await db.collection('example').insert({ example: 'World' })

    const found = await db.collection('example').find({ example: 'Hello' })

    t.equal(found.length, 2, 'Found 2 documents')
    t.ok(doc1._id.equals(found[0]._id), 'Got matched field document')
    t.ok(doc2._id.equals(found[1]._id), 'Got matched array field document')

    t.end()
  } finally {
    await db.close()
  }
})

test('Search by number fields', async (t) => {
  const db = new DB(getBee())

  try {
    await db.collection('example').insert({ example: 4 })
    await db.collection('example').insert({ example: 20 })
    await db.collection('example').insert({ example: 666 })
    await db.collection('example').insert({ example: 9001 })

    const found1 = await db.collection('example').find({
      example: {
        $gte: 10,
        $lte: 20
      }
    })

    t.equal(found1.length, 1, 'Found 1 document >= 10 and <= 20')

    const found2 = await db.collection('example').find({
      example: {
        $gt: 9000
      }
    })

    t.equal(found2.length, 1, 'Found 1 document > 9000')

    const found3 = await db.collection('example').find({
      example: {
        $lt: 10
      }
    })

    t.equal(found3.length, 1, 'Found 1 document < 10')

    t.end()
  } finally {
    await db.close()
  }
})

test('Search by date fields', async (t) => {
  const db = new DB(getBee())

  try {
    await db.collection('example').insert({ example: new Date(2000, 0) })
    await db.collection('example').insert({ example: new Date(2000, 2) })
    await db.collection('example').insert({ example: new Date(2000, 6) })
    await db.collection('example').insert({ example: new Date(2000, 11) })

    const found1 = await db.collection('example').find({
      example: {
        $gte: new Date(2000, 1),
        $lte: new Date(2000, 6)
      }
    })

    t.equal(found1.length, 2, 'Found 2 document >= Feb and <= July')

    t.end()
  } finally {
    await db.close()
  }
})

test('Search using $in and $all', async (t) => {
  const db = new DB(getBee())

  try {
    await db.collection('example').insert({ example: [1, 3, 5, 7, 9] })
    await db.collection('example').insert({ example: [2, 3, 6, 8, 10] })
    await db.collection('example').insert({ example: 1 })
    await db.collection('example').insert({ example: 2 })

    const found1 = await db.collection('example').find({
      example: {
        $in: [1, 3, 8]
      }
    })

    t.equal(found1.length, 3, 'Found 3 matching documents')

    const found2 = await db.collection('example').find({
      example: {
        $all: [2, 6, 8]
      }
    })

    t.equal(found2.length, 1, 'Found 1 matching document')

    t.end()
  } finally {
    await db.close()
  }
})

test('Search using $exists', async (t) => {
  const db = new DB(getBee())

  try {
    await db.collection('example').insert({ example: 'wow' })
    await db.collection('example').insert({ nothing: 'here' })

    const results1 = await db.collection('example').find({
      example: { $exists: true }
    })

    t.equal(results1.length, 1, 'Found document with field')

    const results2 = await db.collection('example').find({
      example: { $exists: false }
    })

    t.equal(results2.length, 1, 'Found document without field')

    t.end()
  } finally {
    await db.close()
  }
})

test('Create indexes and list them', async (t) => {
  const db = new DB(getBee())
  try {
    await db.collection('example').insert({ example: 1, createdAt: new Date() })

    await db.collection('example').createIndex(['createdAt', 'example'])

    const indexes = await db.collection('example').listIndexes()

    t.equal(indexes.length, 1, 'Got one index')
    t.deepEqual(indexes[0].fields, ['createdAt', 'example'], 'Index containes expected fields')
    t.equal(indexes[0].name, ['createdAt', 'example'].join(','), 'Index generated expected name')

    await db.collection('example').insert({ example: 2, createdAt: new Date() })

    t.ok('Able to insert document with index')

    t.end()
  } finally {
    await db.close()
  }
})

test('Sort by index', async (t) => {
  const db = new DB(getBee())
  try {
    await db.collection('example').createIndex(['createdAt'])

    await db.collection('example').insert({ example: 1, createdAt: new Date() })
    await db.collection('example').insert({ example: 2, createdAt: new Date() })
    await db.collection('example').insert({ example: 3, createdAt: new Date() })

    let counter = 3
    for await (const { example } of db.collection('example').find().sort('createdAt', -1)) {
      t.equal(example, counter, 'Got doc in expected order')
      counter--
    }

    t.equal(counter, 0, 'Sorted through all 3 documents')

    t.end()
  } finally {
    await db.close()
  }
})

test('Cannot sort without index', async (t) => {
  const db = new DB(getBee())
  try {
    try {
      await db.collection('example').find().sort('notfound')
    } catch {
      t.pass('Threw error when sorting without index')
    }

    t.end()
  } finally {
    await db.close()
  }
})

test('Limit and skip with index sort', async (t) => {
  const db = new DB(getBee())
  const NUM_TO_MAKE = 30
  let i = NUM_TO_MAKE
  try {
    await db.collection('example').createIndex(['i'])

    while (i--) {
      await db.collection('example').insert({ i })
    }

    const query = db
      .collection('example')
      .find()
      .skip(10)
      .limit(10)
      .sort('i', -1)

    const index = await query.getIndex()

    t.ok(index, 'Using index for search')

    const found = await query

    t.equal(found.length, 10, 'Got expected number of items')

    const onlyIs = found.map(({ i }) => i)

    const expected = [19, 18, 17, 16, 15, 14, 13, 12, 11, 10]

    t.deepEqual(onlyIs, expected, 'Got expected subset of Ids')

    t.end()
  } finally {
    await db.close()
  }
})

test('Use $eq for indexes', async (t) => {
  const db = new DB(getBee())
  try {
    const indexFields = ['color', 'flavor']
    await db.collection('example').createIndex(indexFields)

    await db.collection('example').insert({ example: 1, color: 'red', flavor: 'watermelon' })
    await db.collection('example').insert({ example: 2, color: 'red', flavor: 'raspberry' })
    await db.collection('example').insert({ example: 3, color: 'purple', flavor: 'good' })

    const query = db.collection('example').find({
      color: 'red'
    })

    const index = await query.getIndex()

    t.ok(index, 'Using an index for the query')
    t.deepEqual(index?.index?.fields, indexFields, 'Using the correct index')

    const results = await query

    t.equal(results.length, 2, 'Got expected documents')

    const sortedQuery = query.sort('flavor', -1)

    const sortedIndex = await sortedQuery.getIndex()

    t.ok(sortedIndex, 'Using an index for the sorted query')

    const sorted = await sortedQuery

    t.equal(sorted.length, 2, 'Got expected documents when sorting')
    t.equal(sorted[0]?.flavor, 'watermelon', 'Got expected order for sort')

    t.end()
  } finally {
    await db.close()
  }
})

test('Arrays get flattened for indexes', async (t) => {
  const db = new DB(getBee())
  try {
    await db.collection('example').createIndex(['ingredients', 'name'])

    await db.collection('example').insert({
      name: 'le ghetti du spa',
      ingredients: ['noodles', 'corn', 'sauce']
    })
    await db.collection('example').insert({
      name: 'cheeseland',
      ingredients: ['corn', 'cheese', 'sauce']
    })
    await db.collection('example').insert({
      name: 'literally corn',
      ingredients: ['corn']
    })

    const query = db.collection('example').find({
      ingredients: 'sauce'
    })
      .sort('name')

    const index = await query.getIndex()

    t.ok(index, 'Using an index for the query')
    t.deepEqual(index?.index?.fields, ['ingredients', 'name'], 'Using the correct index')

    const results = await query

    t.equal(results.length, 2, 'Found two matching documents')
    t.equal(results[0]?.name, 'cheeseland', 'Documents got sorted correctly')

    t.end()
  } finally {
    await db.close()
  }
})

test('Indexed Search using $exists', async (t) => {
  const db = new DB(getBee())

  try {
    await db.collection('example').createIndex(['example'])

    await db.collection('example').insert({ example: 'wow' })
    await db.collection('example').insert({ nothing: 'here' })

    const hasIndex = await db.collection('example').find({
      example: { $exists: true }
    }).getIndex()

    t.ok(hasIndex, 'Using index for search')

    const results1 = await db.collection('example').find({
      example: { $exists: true }
    })

    t.equal(results1.length, 1, 'Found document with field')

    const results2 = await db.collection('example').find({
      example: { $exists: false }
    })

    t.equal(results2.length, 1, 'Found document without field')

    t.end()
  } finally {
    await db.close()
  }
})

test('Indexed Search by date fields (with sort)', async (t) => {
  const db = new DB(getBee())

  try {
    await db.collection('example').createIndex(['example'])
    await db.collection('example').insert({ example: new Date(2000, 0) })
    await db.collection('example').insert({ example: new Date(2000, 2) })
    await db.collection('example').insert({ example: new Date(2000, 6) })
    await db.collection('example').insert({ example: new Date(2000, 11) })

    const query = db.collection('example').find({
      example: {
        $gte: new Date(2000, 1),
        $lte: new Date(2000, 6)
      }
    }).sort('example')

    const index = await query.getIndex()

    t.ok(index, 'Using index for date search')

    const found1 = await query

    t.equal(found1.length, 2, 'Found 2 documents >= Feb and <= July')

    t.end()
  } finally {
    await db.close()
  }
})

test('Indexed Search using $in and $all', async (t) => {
  const db = new DB(getBee())

  try {
    await db.collection('example').createIndex(['example'])

    await db.collection('example').insert({ example: [1, 3, 5, 7, 9] })
    await db.collection('example').insert({ example: [2, 3, 6, 8, 10] })
    await db.collection('example').insert({ example: 1 })
    await db.collection('example').insert({ example: 2 })

    const query1 = db.collection('example').find({
      example: {
        $in: [1, 3, 8]
      }
    })

    const index1 = await query1.getIndex()

    t.ok(index1, 'Using index for $in search')

    const found1 = await query1

    t.equal(found1.length, 3, 'Found 3 matching documents')

    const query2 = db.collection('example').find({
      example: {
        $all: [2, 6, 8]
      }
    })

    const index2 = await query2.getIndex()

    t.ok(index2, 'Using index for $all search')

    const found2 = await query2

    t.equal(found2.length, 1, 'Found 1 matching document')

    t.end()
  } finally {
    await db.close()
  }
})

test.only('Indexed text search using sort and $all', async (t) => {
  const db = new DB(getBee())

  try {
    await db.collection('example').createIndex(['index', 'example'])

    await db.collection('example').insert({ index: 1, example: ['hello', 'world'] })
    await db.collection('example').insert({ index: 2, example: ['goodbye', 'world'] })

    const results1 = await db.collection('example').find({
      example: {
        $all: ['world']
      }
    })

    t.equal(results1.length, 2, 'Matched two documents for $all')
    t.end()
  } finally {
    await db.close()
  }
})
