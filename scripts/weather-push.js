async function main() {
  const webhook = process.env.DINGTALK_WEBHOOK;
  if (!webhook) { console.error('缺少 DINGTALK_WEBHOOK'); process.exit(1); }

  // 分部映射：分部→省份
  const BRANCH_MAP = {
    '广州分部': ['广东','广西','海南'],
    '深圳分部': ['深圳'],
    '长沙分部': ['湖南'],
    '厦门分部': ['福建'],
    '成都分部': ['四川','云南','西藏'],
    '重庆分部': ['重庆','贵州'],
    '上海分部': ['上海'],
    '武汉分部': ['湖北'],
    '杭州分部': ['浙江'],
    '北京分部': ['北京','内蒙古'],
    '沈阳分部': ['辽宁'],
    '哈尔滨分部': ['吉林','黑龙江'],
    '苏州分部': ['江苏'],
    '西安分部': ['陕西','青海','宁夏'],
    '郑州分部': ['河南'],
    '南昌分部': ['江西'],
    '济南分部': ['山东'],
    '合肥分部': ['安徽'],
    '新疆分部': ['新疆'],
    '兰州分部': ['甘肃'],
    '太原分部': ['山西'],
    '天津分部': ['天津'],
    '石家庄分部': ['河北']
  };

  // 工号→姓名映射
  const NAMES = {
    '01400388': '陈天祥', '044401': '贺燕清', '022211': '陈易军',
    '547679': '高仁文', '271667': '易津平', '209688': '周青飞',
    '585445': '张淑影', '01394038': '温卓', '542296': '陈显京',
    '122957': '郑伟杰', '01438634': '胡昌', '577764': '陈陈',
    '135169': '陈良格', '398969': '李刚', '41058771': '黄欣磊',
    '01436602': '张金', '01153978': '贺志强', '01411115': '王毅',
    '01386691': '张洋', '40010284': '刘玲', '01436658': '苏东',
    '41283927': '吕猷', '01406948': '王鑫'
  };

  // 分部→负责人工号
  const BRANCH_PERSON = {
    '广州分部': '01400388', '深圳分部': '044401', '长沙分部': '022211',
    '厦门分部': '547679', '成都分部': '271667', '重庆分部': '209688',
    '上海分部': '585445', '武汉分部': '01394038', '杭州分部': '542296',
    '北京分部': '122957', '沈阳分部': '01438634', '哈尔滨分部': '577764',
    '苏州分部': '135169', '西安分部': '398969', '郑州分部': '41058771',
    '南昌分部': '01436602', '济南分部': '01153978', '合肥分部': '01411115',
    '新疆分部': '01386691', '兰州分部': '40010284', '太原分部': '01436658',
    '天津分部': '41283927', '石家庄分部': '01406948'
  };

  // 城市经纬度
  const CITY_LATLON = {
    '广州': [23.13, 113.26], '深圳': [22.54, 114.06],
    '南宁': [22.82, 108.37], '海口': [20.02, 110.35],
    '长沙': [28.23, 112.94], '福州': [26.07, 119.30],
    '成都': [30.57, 104.07], '重庆': [29.56, 106.55],
    '上海': [31.23, 121.47], '武汉': [30.59, 114.31],
    '杭州': [30.27, 120.15], '北京': [39.90, 116.41],
    '沈阳': [41.80, 123.43], '哈尔滨': [45.80, 126.53],
    '苏州': [31.30, 120.62], '西安': [34.34, 108.94],
    '郑州': [34.75, 113.65], '南昌': [28.68, 115.89],
    '济南': [36.67, 117.00], '合肥': [31.86, 117.27],
    '乌鲁木齐': [43.83, 87.62], '兰州': [36.06, 103.83],
    '太原': [37.87, 112.55], '天津': [39.13, 117.20],
    '石家庄': [38.04, 114.51], '贵阳': [26.65, 106.63],
    '昆明': [25.04, 102.68], '长春': [43.88, 125.32]
  };

  const now = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  const dateStr = now.split(' ')[0];

  // 获取所有城市天气
  const allWeather = {};
  const cities = Object.keys(CITY_LATLON);
  for (const city of cities) {
    try {
      const [lat, lon] = CITY_LATLON[city];
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max&timezone=Asia/Shanghai&forecast_days=1`;
      const resp = await fetch(url);
      const data = await resp.json();
      allWeather[city] = {
        temp: data.current?.temperature_2m ?? null,
        maxTemp: data.daily?.temperature_2m_max?.[0] ?? null,
        minTemp: data.daily?.temperature_2m_min?.[0] ?? null,
        precip: data.daily?.precipitation_sum?.[0] ?? null,
        windMax: data.daily?.wind_speed_10m_max?.[0] ?? null
      };
    } catch(e) { allWeather[city] = null; }
  }

  // 分析预警
  const rainAlerts = [];    // 暴雨预警分部
  const heatAlerts = [];    // 高温预警分部
  const typhoonAlerts = []; // 台风预警分部（沿海）
  const normalBranches = []; // 正常分部

  for (const [branch, provinces] of Object.entries(BRANCH_MAP)) {
    const mainCity = provinces[0];
    const w = allWeather[mainCity];
    if (!w) { normalBranches.push(branch); continue; }

    const maxT = w.maxTemp;
    const precip = w.precip;
    let isAlert = false;

    if (precip !== null && precip >= 25) {
      rainAlerts.push({ branch, provinces, maxT, precip, windMax: w.windMax });
      isAlert = true;
    }
    if (maxT !== null && maxT >= 35) {
      heatAlerts.push({ branch, provinces, maxT, precip });
      isAlert = true;
    }
    // 台风：沿海分部且有大风
    const coastal = ['广州分部','深圳分部','厦门分部','杭州分部','上海分部'];
    if (coastal.includes(branch) && w.windMax !== null && w.windMax >= 39) {
      typhoonAlerts.push({ branch, provinces, windMax: w.windMax });
      isAlert = true;
    }
    if (!isAlert) normalBranches.push(branch);
  }

  // 组装消息
  const parts = [];
  parts.push(`## **预警输出** 全国异常天气预警`);
  parts.push('');
  parts.push(`> 数据来源：中央气象台 | 更新时间：${now}`);
  parts.push('');

  // 概览
  const totalAlerts = rainAlerts.length + heatAlerts.length + typhoonAlerts.length;
  const affectedBranches = new Set([...rainAlerts.map(r=>r.branch), ...heatAlerts.map(h=>h.branch), ...typhoonAlerts.map(t=>t.branch)]);
  parts.push(`**今日 ${totalAlerts} 项预警，${affectedBranches.size} 个分部受影响**`);
  parts.push('');

  // 暴雨预警
  if (rainAlerts.length > 0) {
    parts.push(`### 🟡 暴雨预警（${rainAlerts.length}个分部）`);
    parts.push('');
    parts.push(`| 分部 | 省份 | 降水量(mm) | 负责人 |`);
    parts.push(`|:---|:---|:---|:---|`);
    for (const a of rainAlerts) {
      const personId = BRANCH_PERSON[a.branch] || '';
      const personName = NAMES[personId] || '';
      parts.push(`| ${a.branch} | ${a.provinces.join('/')} | ${a.precip !== null ? a.precip.toFixed(1) : '-'} | ${personName} |`);
    }
    const rainIds = rainAlerts.map(a => BRANCH_PERSON[a.branch]).filter(Boolean);
    parts.push('');
    parts.push(`**${rainIds.map(id => '@' + id).join(' ')}**`);
    parts.push('');
  }

  // 高温预警
  if (heatAlerts.length > 0) {
    parts.push(`###  高温预警（${heatAlerts.length}个分部）`);
    parts.push('');
    parts.push(`| 分部 | 省份 | 最高温(℃) | 负责人 |`);
    parts.push(`|:---|:---|:---|:---|`);
    for (const a of heatAlerts) {
      const personId = BRANCH_PERSON[a.branch] || '';
      const personName = NAMES[personId] || '';
      parts.push(`| ${a.branch} | ${a.provinces.join('/')} | ${a.maxT !== null ? a.maxT.toFixed(1) : '-'} | ${personName} |`);
    }
    const heatIds = heatAlerts.map(a => BRANCH_PERSON[a.branch]).filter(Boolean);
    parts.push('');
    parts.push(`**${heatIds.map(id => '@' + id).join(' ')}**`);
    parts.push('');
  }

  // 台风预警
  if (typhoonAlerts.length > 0) {
    parts.push(`### 🌀 台风预警（${typhoonAlerts.length}个分部）`);
    parts.push('');
    parts.push(`| 分部 | 省份 | 最大风力(m/s) | 负责人 |`);
    parts.push(`|:---|:---|:---|:---|`);
    for (const a of typhoonAlerts) {
      const personId = BRANCH_PERSON[a.branch] || '';
      const personName = NAMES[personId] || '';
      parts.push(`| ${a.branch} | ${a.provinces.join('/')} | ${a.windMax !== null ? a.windMax.toFixed(1) : '-'} | ${personName} |`);
    }
    const typhoonIds = typhoonAlerts.map(a => BRANCH_PERSON[a.branch]).filter(Boolean);
    parts.push('');
    parts.push(`**${typhoonIds.map(id => '@' + id).join(' ')}**`);
    parts.push('');
  }

  // 琼州海峡
  const haikouW = allWeather['海口'];
  const qiongzhouStatus = haikouW && haikouW.windMax !== null && haikouW.windMax >= 17.2 ? ' 停航风险' : ' 正常通航';
  parts.push(`### ${qiongzhouStatus} 琼州海峡通航`);
  parts.push('');
  if (haikouW) {
    parts.push(`- 当前风力：${haikouW.windMax !== null ? haikouW.windMax.toFixed(1) + ' m/s' : '-'}`);
    parts.push(`- 最高温：${haikouW.maxTemp !== null ? haikouW.maxTemp.toFixed(1) + '℃' : '-'}`);
  }
  parts.push(`> ⚠️ 通航状态以官网为准，微信搜索"琼州海峡轮渡管家"查询`);
  const gzPerson = BRANCH_PERSON['广州分部'];
  parts.push('');
  parts.push(`**@${gzPerson}**`);
  parts.push('');

  // 正常分部
  if (normalBranches.length > 0) {
    parts.push(`**🟢 正常分部：** ${normalBranches.join('、')}`);
    parts.push('');
  }

  // 重点提示
  parts.push(`### ⚠️ 重点提示`);
  parts.push('');
  if (rainAlerts.length > 0) parts.push(`1. 暴雨防范：请相关分部加强巡查，注意防范积水内涝`);
  if (heatAlerts.length > 0) parts.push(`${rainAlerts.length > 0 ? '2' : '1'}. 高温防暑：户外作业注意避暑降温，合理安排作息时间`);
  if (typhoonAlerts.length > 0) {
    const tipNum = rainAlerts.length > 0 ? 3 : 2;
    parts.push(`${tipNum}. 台风防范：沿海分部密切关注台风动态，做好防台准备`);
  }
  parts.push(`${rainAlerts.length + heatAlerts.length + typhoonAlerts.length > 0 ? (rainAlerts.length + heatAlerts.length + typhoonAlerts.length < 3 ? rainAlerts.length + heatAlerts.length + typhoonAlerts.length + 1 : 4) : '1'}. 通航监测：微信搜索"琼州海峡轮渡管家"查询最新通航状态`);
  parts.push('');
  parts.push(`---`);
  parts.push(`> 异常天气预警小助手 | 推送时间：${now}`);

  const text = parts.join('\n');

  // 收集所有需要@的工号
  const allAtIds = [
    ...rainAlerts.map(a => BRANCH_PERSON[a.branch]),
    ...heatAlerts.map(a => BRANCH_PERSON[a.branch]),
    ...typhoonAlerts.map(a => BRANCH_PERSON[a.branch]),
    gzPerson
  ].filter(Boolean);

  const body = {
    msgtype: 'markdown',
    markdown: { title: '预警输出', text },
    at: { atUserIds: [...new Set(allAtIds)], isAtAll: false }
  };

  const resp = await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  const data = await resp.json();
  console.log('推送结果:', JSON.stringify(data));
  if (data.errcode !== 0) {
    console.error('推送失败:', data.errmsg);
    process.exit(1);
  }
  console.log('推送成功！@了 ' + [...new Set(allAtIds)].length + ' 人');
  console.log('暴雨预警:', rainAlerts.length, '个分部');
  console.log('高温预警:', heatAlerts.length, '个分部');
  console.log('台风预警:', typhoonAlerts.length, '个分部');
  console.log('正常分部:', normalBranches.length, '个');
}

main().catch(e => { console.error(e); process.exit(1); });
