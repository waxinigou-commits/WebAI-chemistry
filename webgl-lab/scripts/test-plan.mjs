const plan = {
  version: 'v1.0.0-webgl-prototype',
  scope: [
    '真 3D 实验台',
    '酒精灯拖动',
    '试管拖动',
    '热区判定',
    '火焰开关',
    '重置逻辑',
    '响应式布局',
  ],
  tests: [
    {
      id: 'T1',
      name: '结构测试',
      passWhen: 'Canvas、重置按钮、火焰开关、4 个状态字段可见',
    },
    {
      id: 'T2',
      name: '拖动交互测试',
      passWhen: '酒精灯与试管都能在实验台上产生明显位移',
    },
    {
      id: 'T3',
      name: '热区逻辑测试',
      passWhen: '试管进入火焰上方后状态切为加热中',
    },
    {
      id: 'T4',
      name: '边界状态测试',
      passWhen: '熄火后不加热，重置后全部恢复初始状态',
    },
    {
      id: 'T5',
      name: '响应式与视觉测试',
      passWhen: '窄屏下侧栏下排，Canvas 仍可见，HUD 与状态卡存在',
    },
  ],
}

console.log(JSON.stringify(plan, null, 2))
