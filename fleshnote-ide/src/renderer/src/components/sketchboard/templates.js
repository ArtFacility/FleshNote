/*
 * Starting points for a new board: a legend (connection types and node
 * kinds) and a few placeholder nodes laid out to show how the pieces fit.
 * Every name goes through t(), so a template arrives in the writer's
 * language. A template becomes one batch of operations on an empty board.
 */

const SIZE = {
  card: [160, 64],
  diamond: [140, 96],
  ellipse: [140, 80],
  hex: [160, 72],
  text: [260, 40],
  frame: [220, 160]
}

// A connection type: its look, as the legend stores it.
const type = (
  key,
  name,
  color_token,
  conn_type = 'solid',
  end_marker = 'arrow',
  start_marker = 'none'
) => ({
  key,
  name,
  color_token,
  conn_type,
  start_marker,
  end_marker
})
const kind = (key, name, shape, color_token) => ({ key, name, shape, color_token })
const node = (key, name, shape, x, y, extra = {}) => ({ key, name, shape, x, y, ...extra })
const edge = (from, to, typeKey, extra = {}) => ({ from, to, typeKey, ...extra })

export function boardTemplates(t) {
  const live = (id, title, desc) => ({
    id,
    title,
    desc,
    live: true,
    types: [],
    kinds: [],
    nodes: [],
    edges: []
  })
  return [
    {
      id: 'blank',
      title: t('sketchboard.tplBlank', 'Blank'),
      desc: t('sketchboard.tplBlankDesc', 'An empty board.'),
      types: [],
      kinds: [],
      nodes: [],
      edges: []
    },
    live(
      'gen_relationships',
      t('sketchboard.tplRelationships', 'Relationships'),
      t(
        'sketchboard.tplRelationshipsDesc',
        'Every character relationship, live from the relationship tracker, as it stands at any chapter.'
      )
    ),
    live(
      'gen_factions',
      t('sketchboard.tplFactions', 'Factions'),
      t(
        'sketchboard.tplFactionsDesc',
        'Factions and their members, live from the rosters, as they stand at any date.'
      )
    ),
    {
      id: 'magic_system',
      title: t('sketchboard.tplMagic', 'Magic system'),
      desc: t(
        'sketchboard.tplMagicDesc',
        'Where power comes from, how it is shaped, what it does and what it costs.'
      ),
      types: [
        type('fuels', t('sketchboard.tplFuels', 'Fuels'), 'amber'),
        type('shapes', t('sketchboard.tplShapes', 'Shapes'), 'blue', 'dashed'),
        type('costs', t('sketchboard.tplCosts', 'Costs'), 'red', 'dotted'),
        type('limits', t('sketchboard.tplLimits', 'Limited by'), 'purple', 'solid', 'bar')
      ],
      kinds: [
        kind('source', t('sketchboard.tplSource', 'Source'), 'diamond', 'amber'),
        kind('channel', t('sketchboard.tplChannel', 'Channel'), 'hex', 'blue'),
        kind('effect', t('sketchboard.tplEffect', 'Effect'), 'ellipse', 'green'),
        kind('price', t('sketchboard.tplPrice', 'Price'), 'card', 'red')
      ],
      nodes: [
        node('source', t('sketchboard.tplSource', 'Source'), 'diamond', 0, 100, { kind: 'source' }),
        node('channel', t('sketchboard.tplChannel', 'Channel'), 'hex', 240, 112, {
          kind: 'channel'
        }),
        node('effect', t('sketchboard.tplEffect', 'Effect'), 'ellipse', 500, 108, {
          kind: 'effect'
        }),
        node('costFrame', t('sketchboard.tplCostFrame', 'Costs'), 'frame', 210, 290),
        node('price', t('sketchboard.tplPriceName', 'What it takes'), 'card', 240, 340, {
          kind: 'price'
        }),
        node('limitFrame', t('sketchboard.tplLimitFrame', 'Limits'), 'frame', 470, 290),
        node('limit', t('sketchboard.tplLimitName', 'What it cannot do'), 'card', 500, 340),
        node(
          'note',
          t('sketchboard.tplMagicNote', 'Rename the placeholders. Tab adds a connected node.'),
          'text',
          0,
          0
        )
      ],
      edges: [
        edge('source', 'channel', 'fuels'),
        edge('channel', 'effect', 'shapes'),
        edge('channel', 'price', 'costs'),
        edge('effect', 'limit', 'limits')
      ]
    },
    {
      id: 'tech_tree',
      title: t('sketchboard.tplTech', 'Tech tree'),
      desc: t('sketchboard.tplTechDesc', 'Discoveries in tiers, each unlocking the next.'),
      types: [
        type('unlocks', t('sketchboard.tplUnlocks', 'Unlocks'), 'blue'),
        type('requires', t('sketchboard.tplRequires', 'Requires'), 'neutral', 'dashed')
      ],
      kinds: [
        kind('discovery', t('sketchboard.tplDiscovery', 'Discovery'), 'card', 'blue'),
        kind('breakthrough', t('sketchboard.tplBreakthrough', 'Breakthrough'), 'hex', 'purple')
      ],
      nodes: [
        node('t1', t('sketchboard.tplTier', 'Tier {{n}}', { n: 'I' }), 'frame', 0, 0, {
          w: 220,
          h: 300
        }),
        node('t2', t('sketchboard.tplTier', 'Tier {{n}}', { n: 'II' }), 'frame', 280, 0, {
          w: 220,
          h: 300
        }),
        node('t3', t('sketchboard.tplTier', 'Tier {{n}}', { n: 'III' }), 'frame', 560, 0, {
          w: 220,
          h: 300
        }),
        node('a', t('sketchboard.tplDiscoveryA', 'First discovery'), 'card', 30, 60, {
          kind: 'discovery'
        }),
        node('b', t('sketchboard.tplDiscoveryB', 'Second discovery'), 'card', 30, 180, {
          kind: 'discovery'
        }),
        node('adv', t('sketchboard.tplAdvance', 'Advance'), 'card', 310, 120, {
          kind: 'discovery'
        }),
        node('top', t('sketchboard.tplBreakthrough', 'Breakthrough'), 'hex', 590, 116, {
          kind: 'breakthrough'
        })
      ],
      edges: [
        edge('a', 'adv', 'unlocks', { routing: 'elbow' }),
        edge('b', 'adv', 'unlocks', { routing: 'elbow' }),
        edge('adv', 'top', 'unlocks', { routing: 'elbow' })
      ]
    },
    {
      id: 'power_structure',
      title: t('sketchboard.tplPower', 'Power structure'),
      desc: t('sketchboard.tplPowerDesc', 'Who commands, who advises, who resents it.'),
      types: [
        type('commands', t('sketchboard.tplCommands', 'Commands'), 'amber'),
        type('advises', t('sketchboard.tplAdvises', 'Advises'), 'blue', 'dashed'),
        type('resents', t('sketchboard.tplResents', 'Resents'), 'red', 'dotted')
      ],
      kinds: [
        kind('authority', t('sketchboard.tplAuthority', 'Authority'), 'diamond', 'amber'),
        kind('institution', t('sketchboard.tplInstitution', 'Institution'), 'card', 'blue'),
        kind('people', t('sketchboard.tplPeople', 'People'), 'ellipse', 'green')
      ],
      nodes: [
        node('ruler', t('sketchboard.tplRuler', 'Ruler'), 'diamond', 290, 0, { kind: 'authority' }),
        node('council', t('sketchboard.tplCouncil', 'Council'), 'card', 80, 170, {
          kind: 'institution'
        }),
        node('army', t('sketchboard.tplArmy', 'Army'), 'card', 480, 170, { kind: 'institution' }),
        node('guilds', t('sketchboard.tplGuilds', 'Guilds'), 'ellipse', 90, 330, {
          kind: 'people'
        }),
        node('commons', t('sketchboard.tplCommons', 'Commons'), 'ellipse', 490, 330, {
          kind: 'people'
        })
      ],
      edges: [
        edge('ruler', 'army', 'commands'),
        edge('council', 'ruler', 'advises'),
        edge('army', 'commons', 'commands'),
        edge('guilds', 'council', 'advises'),
        edge('commons', 'ruler', 'resents', { routing: 'curved' })
      ]
    },
    {
      id: 'economy',
      title: t('sketchboard.tplEconomy', 'Economy'),
      desc: t('sketchboard.tplEconomyDesc', 'What is made, where it flows and who takes a share.'),
      types: [
        type('flows', t('sketchboard.tplFlows', 'Flows to'), 'green'),
        type('taxes', t('sketchboard.tplTaxes', 'Taxed by'), 'amber', 'dashed'),
        type('scarce', t('sketchboard.tplScarce', 'Runs short'), 'red', 'dotted', 'bar')
      ],
      kinds: [
        kind('resource', t('sketchboard.tplResource', 'Resource'), 'hex', 'amber'),
        kind('maker', t('sketchboard.tplMaker', 'Maker'), 'card', 'neutral'),
        kind('sink', t('sketchboard.tplSink', 'Sink'), 'ellipse', 'red')
      ],
      nodes: [
        node('raw', t('sketchboard.tplRaw', 'Raw material'), 'hex', 0, 100, { kind: 'resource' }),
        node('maker', t('sketchboard.tplMakers', 'Makers'), 'card', 230, 104, { kind: 'maker' }),
        node('market', t('sketchboard.tplMarket', 'Market'), 'card', 460, 104, { kind: 'maker' }),
        node('coin', t('sketchboard.tplCoin', 'Coin'), 'hex', 460, 260, { kind: 'resource' }),
        node('crown', t('sketchboard.tplCrown', 'Crown'), 'ellipse', 700, 256, { kind: 'sink' })
      ],
      edges: [
        edge('raw', 'maker', 'flows'),
        edge('maker', 'market', 'flows'),
        edge('market', 'coin', 'flows'),
        edge('coin', 'crown', 'taxes'),
        edge('raw', 'market', 'scarce', { routing: 'curved', waypoints: [[310, 240]] })
      ]
    }
  ]
}

/** The batch that lays a template out on an empty board. `uid` makes row ids. */
export function templateOps(template, uid) {
  const ids = {}
  const idOf = (prefix, key) => (ids[`${prefix}:${key}`] ??= uid())
  const types = Object.fromEntries(template.types.map((ty) => [ty.key, ty]))
  const ops = []
  template.types.forEach((ty, i) => {
    const { key, ...fields } = ty
    ops.push({ op: 'put_type', id: idOf('type', key), fields: { ...fields, sort_order: i } })
  })
  template.kinds.forEach((k, i) => {
    const { key, ...fields } = k
    ops.push({ op: 'put_kind', id: idOf('kind', key), fields: { ...fields, sort_order: i } })
  })
  const kinds = Object.fromEntries(template.kinds.map((k) => [k.key, k]))
  template.nodes.forEach((n) => {
    const [w, h] = [n.w ?? SIZE[n.shape][0], n.h ?? SIZE[n.shape][1]]
    const k = n.kind ? kinds[n.kind] : null
    ops.push({
      op: 'put_node',
      id: idOf('node', n.key),
      fields: {
        name: n.name,
        shape: n.shape,
        color_token: k ? k.color_token : 'neutral',
        pos_x: n.x,
        pos_y: n.y,
        size_x: w,
        size_y: h,
        z_index: n.shape === 'frame' ? -1 : 1,
        ...(k ? { kind_id: idOf('kind', n.kind) } : {})
      }
    })
  })
  template.edges.forEach((e, i) => {
    const ty = types[e.typeKey]
    ops.push({
      op: 'put_edge',
      id: idOf('edge', i),
      fields: {
        item_start_id: idOf('node', e.from),
        item_end_id: idOf('node', e.to),
        routing: e.routing || 'straight',
        ...(e.waypoints ? { waypoints: e.waypoints } : {}),
        type_id: idOf('type', e.typeKey),
        color_token: ty.color_token,
        conn_type: ty.conn_type,
        start_marker: ty.start_marker,
        end_marker: ty.end_marker
      }
    })
  })
  return ops
}
