# 星港防线

一个原生微信小游戏 Canvas 塔防项目。玩家部署炮塔、启动敌袭波次、升级/回收炮塔，并用轨道打击处理密集敌群。

## 复杂系统

- 9 x 10 战术网格和多折线路径。
- 5 波敌袭，每波包含不同敌人组合。
- 4 种炮塔：脉冲塔、轨道炮、霜磁塔、离子炮。
- 5 种敌舰：巡航无人机、掠影艇、装甲运输舰、裂变蜂群、重型母舰。
- 投射物追踪、范围伤害、减速效果、裂变敌人、资源经济、生命值、升级、出售、轨道打击。

## 玩法

- 点底部炮塔按钮选择类型。
- 点网格空位部署炮塔，航道上不能建塔。
- 点“开战”启动波次；战斗中可暂停。
- 点炮塔后可升级或回收。
- 点“打击”后选择网格坐标释放轨道打击。

## 打开

在仓库根目录运行：

```bash
npm run build:release
npm run open:devtools
```

也可以手动导入构建后的 sibling release 目录：

```text
../wechat-mini-star-defense-release
```

## 验证

```bash
npm test
npm run doctor
npm run verify:release
npm run qa:report
unzip -t ../wechat-mini-star-defense-release.zip
unzip -t ../wechat-mini-star-defense.zip
```

验证记录见 `QA.md`。
