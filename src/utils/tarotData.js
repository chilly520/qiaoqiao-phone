/**
 * 塔罗牌数据 - 78张完整牌组
 * 包含22张大阿卡纳 + 56张小阿卡纳
 */

// 大阿卡纳 (22张)
export const majorArcana = [
  {
    id: 0,
    name: '愚者',
    englishName: 'The Fool',
    keywords: ['新的开始', '冒险', '纯真', '自由', '潜力'],
    meaning: {
      upright: '新的开始，冒险精神，纯真信任，自由奔放，无限潜力',
      reversed: '鲁莽冲动，缺乏计划，轻信他人，逃避责任，错失良机'
    },
    element: '风',
    planet: '天王星',
    zodiac: ''
  },
  {
    id: 1,
    name: '魔术师',
    englishName: 'The Magician',
    keywords: ['创造力', '意志力', '显化', '专注', '技巧'],
    meaning: {
      upright: '创造力爆发，强大意志力，显化能力，专注目标，掌握技巧',
      reversed: '欺骗操纵，缺乏自信，能量分散，技能不足，错失机会'
    },
    element: '风',
    planet: '水星',
    zodiac: ''
  },
  {
    id: 2,
    name: '女祭司',
    englishName: 'The High Priestess',
    keywords: ['直觉', '神秘', '潜意识', '智慧', '内在知识'],
    meaning: {
      upright: '直觉敏锐，神秘力量，潜意识觉醒，内在智慧，灵性成长',
      reversed: '忽视直觉，表面判断，秘密暴露，情绪混乱，灵性迷失'
    },
    element: '水',
    planet: '月亮',
    zodiac: ''
  },
  {
    id: 3,
    name: '皇后',
    englishName: 'The Empress',
    keywords: ['丰饶', '母性', '创造力', '自然', '感官享受'],
    meaning: {
      upright: '丰饶富足，母性关怀，创造力涌现，自然和谐，感官满足',
      reversed: '过度依赖，创造力受阻，情感匮乏，自然失衡，物质焦虑'
    },
    element: '土',
    planet: '金星',
    zodiac: ''
  },
  {
    id: 4,
    name: '皇帝',
    englishName: 'The Emperor',
    keywords: ['权威', '结构', '控制', '父性', '秩序'],
    meaning: {
      upright: '建立权威，结构稳固，自我控制，父性保护，秩序井然',
      reversed: '专制独裁，结构崩溃，控制失衡，父权压迫，混乱无序'
    },
    element: '火',
    planet: '火星',
    zodiac: '白羊座'
  },
  {
    id: 5,
    name: '教皇',
    englishName: 'The Hierophant',
    keywords: ['传统', '信仰', '教育', '指导', '精神价值'],
    meaning: {
      upright: '尊重传统，坚定信仰，接受教育，寻求指导，精神追求',
      reversed: '打破传统，信仰危机，反叛权威，非传统路径，精神困惑'
    },
    element: '土',
    planet: '',
    zodiac: '金牛座'
  },
  {
    id: 6,
    name: '恋人',
    englishName: 'The Lovers',
    keywords: ['爱情', '选择', '和谐', '价值观', '结合'],
    meaning: {
      upright: '爱情降临，重要选择，关系和谐，价值观一致，灵魂结合',
      reversed: '关系失衡，错误选择，价值观冲突，沟通障碍，分离危机'
    },
    element: '风',
    planet: '水星',
    zodiac: '双子座'
  },
  {
    id: 7,
    name: '战车',
    englishName: 'The Chariot',
    keywords: ['意志力', '胜利', '控制', '决心', '前进'],
    meaning: {
      upright: '坚定意志，取得胜利，自我控制，决心达成，勇往直前',
      reversed: '意志动摇，失败挫折，失控混乱，缺乏方向，停滞不前'
    },
    element: '水',
    planet: '月亮',
    zodiac: '巨蟹座'
  },
  {
    id: 8,
    name: '力量',
    englishName: 'Strength',
    keywords: ['勇气', '耐心', '内在力量', '同情心', '影响力'],
    meaning: {
      upright: '展现勇气，保持耐心，内在力量，同情理解，正面影响',
      reversed: '恐惧退缩，缺乏耐心，内在软弱，情绪失控，负面影响'
    },
    element: '火',
    planet: '太阳',
    zodiac: '狮子座'
  },
  {
    id: 9,
    name: '隐者',
    englishName: 'The Hermit',
    keywords: ['内省', '独处', '寻求真理', '智慧', '指引'],
    meaning: {
      upright: '深度内省，享受独处，寻求真理，获得智慧，内在指引',
      reversed: '孤立自己，逃避现实，拒绝指引，迷失方向，过度隐居'
    },
    element: '土',
    planet: '水星',
    zodiac: '处女座'
  },
  {
    id: 10,
    name: '命运之轮',
    englishName: 'Wheel of Fortune',
    keywords: ['命运', '转变', '周期', '机遇', '业力'],
    meaning: {
      upright: '命运转折，积极转变，生命周期，把握机遇，业力显现',
      reversed: '厄运降临，抗拒改变，周期停滞，错失机遇，负面业力'
    },
    element: '火',
    planet: '木星',
    zodiac: ''
  },
  {
    id: 11,
    name: '正义',
    englishName: 'Justice',
    keywords: ['公平', '真理', '法律', '因果', '平衡'],
    meaning: {
      upright: '追求公平，面对真理，法律公正，因果报应，保持平衡',
      reversed: '不公不义，隐瞒真相，法律纠纷，逃避责任，失衡状态'
    },
    element: '风',
    planet: '',
    zodiac: '天秤座'
  },
  {
    id: 12,
    name: '倒吊人',
    englishName: 'The Hanged Man',
    keywords: ['牺牲', '暂停', '新视角', '放手', '等待'],
    meaning: {
      upright: '愿意牺牲，暂停行动，换个角度，学会放手，耐心等待',
      reversed: '抗拒改变，无谓牺牲，固执己见，无法放手，焦虑等待'
    },
    element: '水',
    planet: '海王星',
    zodiac: ''
  },
  {
    id: 13,
    name: '死神',
    englishName: 'Death',
    keywords: ['结束', '转变', '重生', '释放', '蜕变'],
    meaning: {
      upright: '接受结束，迎接转变，获得重生，释放过去，蜕变成长',
      reversed: '抗拒结束，害怕改变，停滞不前，紧抓过去，拒绝蜕变'
    },
    element: '水',
    planet: '冥王星',
    zodiac: '天蝎座'
  },
  {
    id: 14,
    name: '节制',
    englishName: 'Temperance',
    keywords: ['平衡', '调和', '耐心', '中庸', '融合'],
    meaning: {
      upright: '寻求平衡，调和矛盾，保持耐心，中庸之道，融合统一',
      reversed: '失衡状态，极端行为，缺乏耐心，过度放纵，分裂对立'
    },
    element: '火',
    planet: '木星',
    zodiac: '射手座'
  },
  {
    id: 15,
    name: '恶魔',
    englishName: 'The Devil',
    keywords: ['束缚', '欲望', '物质主义', '诱惑', '阴影'],
    meaning: {
      upright: '认识束缚，面对欲望，物质依赖，抵抗诱惑，探索阴影',
      reversed: '打破束缚，超越欲望，精神觉醒，拒绝诱惑，面对阴影'
    },
    element: '土',
    planet: '土星',
    zodiac: '摩羯座'
  },
  {
    id: 16,
    name: '高塔',
    englishName: 'The Tower',
    keywords: ['突变', '觉醒', '破坏', '启示', '解放'],
    meaning: {
      upright: '突然变化，被迫觉醒，旧结构破坏，获得启示，获得解放',
      reversed: '避免变化，抗拒觉醒，勉强维持，拒绝启示，持续束缚'
    },
    element: '火',
    planet: '火星',
    zodiac: ''
  },
  {
    id: 17,
    name: '星星',
    englishName: 'The Star',
    keywords: ['希望', '灵感', '宁静', '信心', '灵性'],
    meaning: {
      upright: '怀抱希望，获得灵感，内心宁静，充满信心，灵性觉醒',
      reversed: '失去希望，缺乏灵感，内心焦虑，信心动摇，灵性迷茫'
    },
    element: '风',
    planet: '天王星',
    zodiac: '水瓶座'
  },
  {
    id: 18,
    name: '月亮',
    englishName: 'The Moon',
    keywords: ['幻觉', '恐惧', '潜意识', '直觉', '神秘'],
    meaning: {
      upright: '面对幻觉，克服恐惧，潜意识浮现，信任直觉，探索神秘',
      reversed: '摆脱幻觉，释放恐惧，潜意识混乱，忽视直觉，拒绝神秘'
    },
    element: '水',
    planet: '海王星',
    zodiac: '双鱼座'
  },
  {
    id: 19,
    name: '太阳',
    englishName: 'The Sun',
    keywords: ['快乐', '成功', '活力', '真相', '积极'],
    meaning: {
      upright: '感受快乐，获得成功，充满活力，面对真相，保持积极',
      reversed: '暂时沮丧，小挫折，能量低落，部分真相，过度乐观'
    },
    element: '火',
    planet: '太阳',
    zodiac: ''
  },
  {
    id: 20,
    name: '审判',
    englishName: 'Judgement',
    keywords: ['重生', '觉醒', '评估', '宽恕', '召唤'],
    meaning: {
      upright: '获得重生，灵性觉醒，自我评估，学会宽恕，响应召唤',
      reversed: '拒绝重生，逃避觉醒，错误评估，无法宽恕，忽视召唤'
    },
    element: '火',
    planet: '冥王星',
    zodiac: ''
  },
  {
    id: 21,
    name: '世界',
    englishName: 'The World',
    keywords: ['完成', '圆满', '成就', '整合', '旅行'],
    meaning: {
      upright: '任务完成，获得圆满，取得成就，身心整合，开启旅程',
      reversed: '未能完成，缺乏圆满，成就感低，身心分离，旅程受阻'
    },
    element: '土',
    planet: '土星',
    zodiac: ''
  }
]

// 小阿卡纳 - 权杖牌组 (14张)
export const wands = [
  { id: 22, name: '权杖首牌', englishName: 'Ace of Wands', suit: 'wands', number: 1, element: '火', keywords: ['灵感', '创造', '激情', '新机会'], meaning: { upright: '灵感涌现，创造开始，激情点燃，新机会出现', reversed: '灵感枯竭，创造受阻，激情消退，错失机会' } },
  { id: 23, name: '权杖二', englishName: 'Two of Wands', suit: 'wands', number: 2, element: '火', keywords: ['计划', '决策', '探索', '远见'], meaning: { upright: '制定计划，做出决策，探索可能，远见卓识', reversed: '计划混乱，犹豫不决，恐惧探索，目光短浅' } },
  { id: 24, name: '权杖三', englishName: 'Three of Wands', suit: 'wands', number: 3, element: '火', keywords: ['扩展', '远见', '进展', '合作'], meaning: { upright: '事业扩展，远见实现，进展顺利，合作成功', reversed: '扩展受阻，远见落空，进展缓慢，合作失败' } },
  { id: 25, name: '权杖四', englishName: 'Four of Wands', suit: 'wands', number: 4, element: '火', keywords: ['庆祝', '稳定', '和谐', '成就'], meaning: { upright: '值得庆祝，关系稳定，家庭和谐，初步成就', reversed: '庆祝取消，不稳定，家庭冲突，成就受阻' } },
  { id: 26, name: '权杖五', englishName: 'Five of Wands', suit: 'wands', number: 5, element: '火', keywords: ['冲突', '竞争', '挑战', '分歧'], meaning: { upright: '面对冲突，健康竞争，接受挑战，解决分歧', reversed: '避免冲突，恶性竞争，逃避挑战，分歧加剧' } },
  { id: 27, name: '权杖六', englishName: 'Six of Wands', suit: 'wands', number: 6, element: '火', keywords: ['胜利', '认可', '自信', '好消息'], meaning: { upright: '获得胜利，得到认可，充满自信，好消息到来', reversed: '骄傲自满，认可延迟，自信不足，坏消息' } },
  { id: 28, name: '权杖七', englishName: 'Seven of Wands', suit: 'wands', number: 7, element: '火', keywords: ['防御', '坚持', '勇气', '立场'], meaning: { upright: '勇敢防御，坚持立场，展现勇气，维护信念', reversed: '放弃防御，立场动摇，缺乏勇气，信念崩溃' } },
  { id: 29, name: '权杖八', englishName: 'Eight of Wands', suit: 'wands', number: 8, element: '火', keywords: ['速度', '行动', '进展', '消息'], meaning: { upright: '快速行动，迅速进展，消息传来，势头强劲', reversed: '行动迟缓，进展受阻，消息延迟，势头减弱' } },
  { id: 30, name: '权杖九', englishName: 'Nine of Wands', suit: 'wands', number: 9, element: '火', keywords: ['韧性', '坚持', '防备', '最后防线'], meaning: { upright: '展现韧性，坚持到底，保持防备，守护成果', reversed: '筋疲力尽，想要放弃，防备松懈，防线崩溃' } },
  { id: 31, name: '权杖十', englishName: 'Ten of Wands', suit: 'wands', number: 10, element: '火', keywords: ['负担', '责任', '压力', '过劳'], meaning: { upright: '承担责任，承受负担，面对压力，努力工作', reversed: '负担过重，推卸责任，压力崩溃，精疲力竭' } },
  { id: 32, name: '权杖侍从', englishName: 'Page of Wands', suit: 'wands', number: 11, element: '火', keywords: ['热情', '探索', '新想法', '自由精神'], meaning: { upright: '充满热情，探索新领域，产生新想法，自由奔放', reversed: '热情消退，探索受阻，想法幼稚，不负责任' } },
  { id: 33, name: '权杖骑士', englishName: 'Knight of Wands', suit: 'wands', number: 12, element: '火', keywords: ['冒险', '行动', '激情', '冲动'], meaning: { upright: '勇于冒险，积极行动，充满激情，追求目标', reversed: '鲁莽冒险，行动鲁莽，激情过度，冲动行事' } },
  { id: 34, name: '权杖皇后', englishName: 'Queen of Wands', suit: 'wands', number: 13, element: '火', keywords: ['自信', '热情', '魅力', '独立'], meaning: { upright: '充满自信，热情洋溢，散发魅力，独立自主', reversed: '自信不足，热情消退，魅力缺失，过度依赖' } },
  { id: 35, name: '权杖国王', englishName: 'King of Wands', suit: 'wands', number: 14, element: '火', keywords: ['领导力', '远见', '魅力', '创业'], meaning: { upright: '展现领导力，远见卓识，个人魅力，创业精神', reversed: '专横跋扈，目光短浅，魅力虚假，冲动创业' } }
]

// 小阿卡纳 - 圣杯牌组 (14张)
export const cups = [
  { id: 36, name: '圣杯首牌', englishName: 'Ace of Cups', suit: 'cups', number: 1, element: '水', keywords: ['爱', '情感', '直觉', '新关系'], meaning: { upright: '新的爱情，情感涌现，直觉增强，新关系开始', reversed: '情感封闭，爱情受阻，直觉混乱，关系结束' } },
  { id: 37, name: '圣杯二', englishName: 'Two of Cups', suit: 'cups', number: 2, element: '水', keywords: ['结合', '伙伴关系', '和谐', '相互吸引'], meaning: { upright: '关系结合，伙伴关系，和谐相处，相互吸引', reversed: '关系破裂，伙伴关系结束，不和谐，吸引力消失' } },
  { id: 38, name: '圣杯三', englishName: 'Three of Cups', suit: 'cups', number: 3, element: '水', keywords: ['庆祝', '友谊', '社交', '快乐'], meaning: { upright: '共同庆祝，友谊加深，社交活跃，感受快乐', reversed: '过度庆祝，友谊破裂，社交孤立，表面快乐' } },
  { id: 39, name: '圣杯四', englishName: 'Four of Cups', suit: 'cups', number: 4, element: '水', keywords: ['沉思', '不满', '冷漠', '重新评估'], meaning: { upright: '深度沉思，感到不满，暂时冷漠，重新评估', reversed: '走出沉思，接受现状，重新参与，积极评估' } },
  { id: 40, name: '圣杯五', englishName: 'Five of Cups', suit: 'cups', number: 5, element: '水', keywords: ['失落', '悲伤', '失望', '遗憾'], meaning: { upright: '经历失落，感到悲伤，面对失望，心存遗憾', reversed: '走出悲伤，接受失落，看到希望，释放遗憾' } },
  { id: 41, name: '圣杯六', englishName: 'Six of Cups', suit: 'cups', number: 6, element: '水', keywords: ['怀旧', '童年', '纯真', '礼物'], meaning: { upright: '怀念过去，童年回忆，保持纯真，收到礼物', reversed: '沉溺过去，童年创伤，失去纯真，礼物陷阱' } },
  { id: 42, name: '圣杯七', englishName: 'Seven of Cups', suit: 'cups', number: 7, element: '水', keywords: ['选择', '幻想', '梦想', '诱惑'], meaning: { upright: '面临选择，产生幻想，追逐梦想，面对诱惑', reversed: '选择困难，幻想破灭，梦想落空，抵制诱惑' } },
  { id: 43, name: '圣杯八', englishName: 'Eight of Cups', suit: 'cups', number: 8, element: '水', keywords: ['离开', '放弃', '寻求', '转变'], meaning: { upright: '选择离开，放弃旧物，寻求更多，开始转变', reversed: '无法离开，紧抓不放，害怕寻求，抗拒转变' } },
  { id: 44, name: '圣杯九', englishName: 'Nine of Cups', suit: 'cups', number: 9, element: '水', keywords: ['满足', '愿望', '幸福', '享受'], meaning: { upright: '感到满足，愿望实现，体验幸福，享受生活', reversed: '永不满足，愿望落空，虚假幸福，过度放纵' } },
  { id: 45, name: '圣杯十', englishName: 'Ten of Cups', suit: 'cups', number: 10, element: '水', keywords: ['家庭', '和谐', '爱', '圆满'], meaning: { upright: '家庭和谐，关系圆满，充满爱意，情感满足', reversed: '家庭冲突，关系破裂，爱意缺失，情感空虚' } },
  { id: 46, name: '圣杯侍从', englishName: 'Page of Cups', suit: 'cups', number: 11, element: '水', keywords: ['敏感', '直觉', '创意', '新情感'], meaning: { upright: '情感敏感，直觉增强，创意涌现，新情感开始', reversed: '过度敏感，直觉混乱，创意受阻，情感幼稚' } },
  { id: 47, name: '圣杯骑士', englishName: 'Knight of Cups', suit: 'cups', number: 12, element: '水', keywords: ['浪漫', '追求', '魅力', '邀请'], meaning: { upright: '浪漫追求，魅力四射，发出邀请，情感表达', reversed: '虚假浪漫，逃避承诺，魅力伪装，拒绝邀请' } },
  { id: 48, name: '圣杯皇后', englishName: 'Queen of Cups', suit: 'cups', number: 13, element: '水', keywords: ['同情', '直觉', '情感', '关怀'], meaning: { upright: '富有同情，直觉敏锐，情感丰富，关怀他人', reversed: '过度同情，情绪失控，情感依赖，自我忽视' } },
  { id: 49, name: '圣杯国王', englishName: 'King of Cups', suit: 'cups', number: 14, element: '水', keywords: ['情感控制', '智慧', '外交', '平衡'], meaning: { upright: '情感控制，智慧成熟，外交手腕，保持平衡', reversed: '情绪失控，操纵他人，外交伪装，失衡状态' } }
]

// 小阿卡纳 - 宝剑牌组 (14张)
export const swords = [
  { id: 50, name: '宝剑首牌', englishName: 'Ace of Swords', suit: 'swords', number: 1, element: '风', keywords: ['清晰', '突破', '真理', '新想法'], meaning: { upright: '思维清晰，突破障碍，面对真理，新想法产生', reversed: '思维混乱，突破受阻，拒绝真理，想法错误' } },
  { id: 51, name: '宝剑二', englishName: 'Two of Swords', suit: 'swords', number: 2, element: '风', keywords: ['僵局', '选择', '回避', '平衡'], meaning: { upright: '面临僵局，难以选择，回避问题，寻求平衡', reversed: '打破僵局，做出选择，面对问题，失衡状态' } },
  { id: 52, name: '宝剑三', englishName: 'Three of Swords', suit: 'swords', number: 3, element: '风', keywords: ['心痛', '悲伤', '拒绝', '背叛'], meaning: { upright: '经历心痛，感到悲伤，面对拒绝，遭遇背叛', reversed: '走出心痛，释放悲伤，接受拒绝，原谅背叛' } },
  { id: 53, name: '宝剑四', englishName: 'Four of Swords', suit: 'swords', number: 4, element: '风', keywords: ['休息', '恢复', '沉思', '平静'], meaning: { upright: '需要休息，恢复能量，深度沉思，寻求平静', reversed: '无法休息，恢复缓慢，焦虑沉思，内心不安' } },
  { id: 54, name: '宝剑五', englishName: 'Five of Swords', suit: 'swords', number: 5, element: '风', keywords: ['冲突', '失败', '损失', '自私'], meaning: { upright: '面对冲突，接受失败，承受损失，自私行为', reversed: '化解冲突，从失败学习，减少损失，无私行为' } },
  { id: 55, name: '宝剑六', englishName: 'Six of Swords', suit: 'swords', number: 6, element: '风', keywords: ['过渡', '离开', '疗愈', '前进'], meaning: { upright: '经历过渡，选择离开，开始疗愈，继续前进', reversed: '过渡困难，无法离开，疗愈受阻，停滞不前' } },
  { id: 56, name: '宝剑七', englishName: 'Seven of Swords', suit: 'swords', number: 7, element: '风', keywords: ['欺骗', '策略', '偷窃', '逃避'], meaning: { upright: '需要策略，小心欺骗，灵活应对，暂时逃避', reversed: '欺骗暴露，策略失败，偷窃被抓，无法逃避' } },
  { id: 57, name: '宝剑八', englishName: 'Eight of Swords', suit: 'swords', number: 8, element: '风', keywords: ['限制', '束缚', '无助', '自我设限'], meaning: { upright: '感到限制，受到束缚，感到无助，自我设限', reversed: '打破限制，挣脱束缚，获得帮助，突破自我' } },
  { id: 58, name: '宝剑九', englishName: 'Nine of Swords', suit: 'swords', number: 9, element: '风', keywords: ['焦虑', '噩梦', '恐惧', '内疚'], meaning: { upright: '经历焦虑，做噩梦，面对恐惧，感到内疚', reversed: '释放焦虑，摆脱噩梦，克服恐惧，原谅自己' } },
  { id: 59, name: '宝剑十', englishName: 'Ten of Swords', suit: 'swords', number: 10, element: '风', keywords: ['结束', '痛苦', '背叛', '崩溃'], meaning: { upright: '经历结束，承受痛苦，遭遇背叛，感到崩溃', reversed: '结束开始，痛苦减轻，原谅背叛，逐渐恢复' } },
  { id: 60, name: '宝剑侍从', englishName: 'Page of Swords', suit: 'swords', number: 11, element: '风', keywords: ['好奇', '警觉', '新想法', '沟通'], meaning: { upright: '保持好奇，警觉敏锐，新想法涌现，积极沟通', reversed: '过度好奇，警觉过度，想法幼稚，沟通障碍' } },
  { id: 61, name: '宝剑骑士', englishName: 'Knight of Swords', suit: 'swords', number: 12, element: '风', keywords: ['行动', '冲动', '激进', '果断'], meaning: { upright: '快速行动，果断决策，激进进取，追求目标', reversed: '鲁莽行动，冲动决策，过于激进，目标迷失' } },
  { id: 62, name: '宝剑皇后', englishName: 'Queen of Swords', suit: 'swords', number: 13, element: '风', keywords: ['独立', '清晰', '智慧', '直率'], meaning: { upright: '独立自主，思维清晰，智慧成熟，直率坦诚', reversed: '过度独立，思维混乱，冷酷无情，言语刻薄' } },
  { id: 63, name: '宝剑国王', englishName: 'King of Swords', suit: 'swords', number: 14, element: '风', keywords: ['权威', '真理', '智慧', '公正'], meaning: { upright: '展现权威，追求真理，智慧领导，公正裁决', reversed: '滥用权威，歪曲真理，冷酷领导，不公正' } }
]

// 小阿卡纳 - 星币牌组 (14张)
export const pentacles = [
  { id: 64, name: '星币首牌', englishName: 'Ace of Pentacles', suit: 'pentacles', number: 1, element: '土', keywords: ['机会', '财富', '实现', '新开始'], meaning: { upright: '新机会出现，财富增长，目标实现，新的开始', reversed: '错失机会，财富损失，目标受阻，开始困难' } },
  { id: 65, name: '星币二', englishName: 'Two of Pentacles', suit: 'pentacles', number: 2, element: '土', keywords: ['平衡', '适应', '灵活', '多任务'], meaning: { upright: '保持平衡，适应变化，灵活应对，多任务处理', reversed: '失去平衡，无法适应，僵化固执，任务混乱' } },
  { id: 66, name: '星币三', englishName: 'Three of Pentacles', suit: 'pentacles', number: 3, element: '土', keywords: ['合作', '技能', '学习', '团队'], meaning: { upright: '团队合作，技能提升，学习成长，团队成功', reversed: '合作失败，技能不足，学习困难，团队冲突' } },
  { id: 67, name: '星币四', englishName: 'Four of Pentacles', suit: 'pentacles', number: 4, element: '土', keywords: ['控制', '稳定', '保守', '占有欲'], meaning: { upright: '财务控制，保持稳定，保守谨慎，占有欲强', reversed: '控制过度，稳定动摇，过于保守，占有欲失控' } },
  { id: 68, name: '星币五', englishName: 'Five of Pentacles', suit: 'pentacles', number: 5, element: '土', keywords: ['困难', '损失', '孤立', '贫困'], meaning: { upright: '面临困难，承受损失，感到孤立，经济贫困', reversed: '困难结束，损失恢复，走出孤立，经济状况改善' } },
  { id: 69, name: '星币六', englishName: 'Six of Pentacles', suit: 'pentacles', number: 6, element: '土', keywords: ['给予', '接受', '慷慨', '平衡'], meaning: { upright: '慷慨给予，愿意接受，保持平衡，互相帮助', reversed: '给予不均，不愿接受，吝啬小气，失衡状态' } },
  { id: 70, name: '星币七', englishName: 'Seven of Pentacles', suit: 'pentacles', number: 7, element: '土', keywords: ['评估', '耐心', '投资', '成长'], meaning: { upright: '评估进展，保持耐心，投资回报，持续成长', reversed: '评估错误，缺乏耐心，投资失败，成长停滞' } },
  { id: 71, name: '星币八', englishName: 'Eight of Pentacles', suit: 'pentacles', number: 8, element: '土', keywords: ['技能', '工作', '专注', '精通'], meaning: { upright: '技能精进，努力工作，专注目标，追求精通', reversed: '技能不足，工作懈怠，分心走神，缺乏精通' } },
  { id: 72, name: '星币九', englishName: 'Nine of Pentacles', suit: 'pentacles', number: 9, element: '土', keywords: ['独立', '富足', '自律', '享受'], meaning: { upright: '经济独立，生活富足，自律自强，享受成果', reversed: '依赖他人，财务困难，缺乏自律，无法享受' } },
  { id: 73, name: '星币十', englishName: 'Ten of Pentacles', suit: 'pentacles', number: 10, element: '土', keywords: ['财富', '遗产', '家庭', '长期'], meaning: { upright: '家族财富，遗产继承，家庭稳定，长期规划', reversed: '财务损失，遗产纠纷，家庭不和，短期思维' } },
  { id: 74, name: '星币侍从', englishName: 'Page of Pentacles', suit: 'pentacles', number: 11, element: '土', keywords: ['机会', '学习', '务实', '新开始'], meaning: { upright: '新机会出现，学习新技能，务实态度，新的开始', reversed: '错失机会，学习困难，不切实际，开始受阻' } },
  { id: 75, name: '星币骑士', englishName: 'Knight of Pentacles', suit: 'pentacles', number: 12, element: '土', keywords: ['勤奋', '责任', '耐心', '稳定'], meaning: { upright: '勤奋工作，承担责任，保持耐心，追求稳定', reversed: '工作懈怠，逃避责任，缺乏耐心，不稳定' } },
  { id: 76, name: '星币皇后', englishName: 'Queen of Pentacles', suit: 'pentacles', number: 13, element: '土', keywords: ['滋养', '务实', '富足', '关怀'], meaning: { upright: '滋养他人，务实态度，生活富足，关怀备至', reversed: '过度保护，不切实际，财务困难，自我忽视' } },
  { id: 77, name: '星币国王', englishName: 'King of Pentacles', suit: 'pentacles', number: 14, element: '土', keywords: ['成功', '财富', '领导力', '稳定'], meaning: { upright: '事业成功，财富丰厚，展现领导力，保持稳定', reversed: '事业失败，财务损失，专横领导，不稳定' } }
]

// 所有塔罗牌
export const allTarotCards = [...majorArcana, ...wands, ...cups, ...swords, ...pentacles]

// 牌阵配置
export const tarotSpreads = [
  {
    id: 'single',
    name: '单张牌',
    description: '最简单的牌阵，适合快速获得指引',
    cardCount: 1,
    positions: [
      { name: '指引', description: '当前问题的核心指引' }
    ]
  },
  {
    id: 'three',
    name: '三张牌',
    description: '经典的三张牌阵，揭示过去、现在、未来',
    cardCount: 3,
    positions: [
      { name: '过去', description: '影响当前情况的过去因素' },
      { name: '现在', description: '当前的状况和能量' },
      { name: '未来', description: '可能的发展趋势和结果' }
    ]
  },
  {
    id: 'celtic',
    name: '凯尔特十字',
    description: '最全面的牌阵，深入分析问题的各个层面',
    cardCount: 10,
    positions: [
      { name: '现状', description: '当前的核心状况' },
      { name: '挑战', description: '面临的阻碍或挑战' },
      { name: '过去', description: '影响现在的过去基础' },
      { name: '未来', description: '即将发生的情况' },
      { name: '上方', description: '你的目标和愿望' },
      { name: '下方', description: '潜意识的影响' },
      { name: '建议', description: '给你的建议' },
      { name: '环境', description: '外部环境和他人影响' },
      { name: '希望', description: '你的希望和恐惧' },
      { name: '结果', description: '最终可能的结果' }
    ]
  },
  {
    id: 'relationship',
    name: '关系牌阵',
    description: '专门用于分析两人关系的牌阵',
    cardCount: 5,
    positions: [
      { name: '你', description: '你在关系中的状态' },
      { name: '对方', description: '对方在关系中的状态' },
      { name: '关系', description: '关系的现状' },
      { name: '挑战', description: '关系面临的挑战' },
      { name: '未来', description: '关系的发展方向' }
    ]
  },
  {
    id: 'decision',
    name: '决策牌阵',
    description: '帮助你做出重要决定的牌阵',
    cardCount: 4,
    positions: [
      { name: '选择A', description: '选择A的结果' },
      { name: '选择B', description: '选择B的结果' },
      { name: '建议', description: '给你的建议' },
      { name: '结果', description: '最佳选择' }
    ]
  }
]

// 获取随机牌
export function getRandomCards(count = 1) {
  const shuffled = [...allTarotCards].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count).map(card => ({
    ...card,
    isReversed: Math.random() < 0.15, // 15%概率逆位
    uuid: Math.random().toString(36).substring(2, 9)
  }))
}

// 获取牌阵
export function getSpread(spreadId) {
  return tarotSpreads.find(s => s.id === spreadId) || tarotSpreads[0]
}

// 获取牌面含义
export function getCardMeaning(card) {
  const meaning = card.isReversed ? card.meaning.reversed : card.meaning.upright
  const position = card.isReversed ? '逆位' : '正位'
  return { meaning, position }
}

// 生成解牌提示词
export function generateTarotPrompt(question, cards, spreadName) {
  const cardDescriptions = cards.map((card, index) => {
    const { meaning, position } = getCardMeaning(card)
    const positionName = card.positionName || `第${index + 1}张`
    return `${positionName}：${card.name}（${position}）- ${meaning}`
  }).join('\n')

  return `你是一位经验丰富的塔罗牌解牌师。请根据以下信息为用户提供专业、温暖且富有洞察力的解牌：

【问题】${question || '未指定具体问题'}

【牌阵】${spreadName}

【抽到的牌】
${cardDescriptions}

请提供以下内容的解牌：
1. 整体能量概述（2-3句话）
2. 每张牌的详细解读（结合牌的位置）
3. 针对问题的具体建议
4. 积极的鼓励话语

语气要温暖、专业、富有同理心，避免过于消极的表述。`
}

export default {
  majorArcana,
  wands,
  cups,
  swords,
  pentacles,
  allTarotCards,
  tarotSpreads,
  getRandomCards,
  getSpread,
  getCardMeaning,
  generateTarotPrompt
}
