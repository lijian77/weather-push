async function main() {
  const webhook = process.env.DINGTALK_WEBHOOK;
  if (!webhook) { console.error('缺少 DINGTALK_WEBHOOK'); process.exit(1); }

  // 工号映射表（工号 → 姓名）
  const NAMES = {
    '209688': '周青飞', '01400388': '陈天祥', '022211': '陈易军',
    '01411115': '王毅', '542296': '陈显京', '01436602': '张金',
    '271667': '易津平', '585445': '张淑影', '135169': '陈良格',
    '01394038': '温卓', '122957': '郑伟杰', '41283927': '吕猷',
    '01406948': '王鑫', '01153978': '贺志强', '41058771': '黄欣磊',
    '01436658': '苏东', '398969': '李刚', '01386691': '张洋',
    '547679': '高仁文', '40010284': '刘玲', '01438634': '胡昌',
    '577764': '陈陈', '044401': '贺燕清'
  };

  const userIds = Object.keys(NAMES);
  const names = userIds.map(id => NAMES[id]).join('、');

  const text = `## 🔴 全国异常天气预警

今日全国天气预警概览：

> 数据来源：中央气象台 | 更新时间：${new Date().toLocaleString('zh-CN', {timeZone: 'Asia/Shanghai'})}

### 🌡️ 今日天气

- 最高温：28℃
- 最低温：18℃
- 天气状况：晴转多云

### 🟢 琼州海峡通航

当前正常通航

> ⚠️ 通航状态以官网为准，微信搜索"琼州海峡轮渡管家"查询

---
> 异常天气预警小助手
> 推送时间：${new Date().toLocaleString('zh-CN', {timeZone: 'Asia/Shanghai'})}`;

  const body = {
    msgtype: 'markdown',
   markdown: { title: '预警输出', text: '预警输出\n\n' + text },
    at: {
      atUserIds: userIds,
      isAtAll: false
    }
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
  console.log('推送成功！@了 ' + userIds.length + ' 人：' + names);
}

main().catch(e => { console.error(e); process.exit(1); });
