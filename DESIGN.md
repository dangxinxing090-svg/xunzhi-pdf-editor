---
name: "Xunzhi PDF Editor — 工程制图桌"
description: "把 PDF 当图纸对待的桌面仪器:图纸白纸面层级、蓝黑墨线文字、普鲁士蓝只落在可操作元素上、图签式状态栏。"
colors:
  paper: "#fbfcfd"
  table: "#edf0f4"
  panel: "#f4f6f9"
  plate: "#ffffff"
  plate-sunken: "#e9edf2"
  ink: "#1c2a3a"
  ink-soft: "#46586c"
  ink-mute: "#6f7f92"
  ink-faint: "#9fabbb"
  ink-numeral: "#5d6e81"
  hairline: "#dde3ea"
  hairline-strong: "#c8d1db"
  accent: "#1e56b0"
  accent-deep: "#17437f"
  accent-tint: "#edf3fb"
  accent-tint-2: "#dbe8f8"
  accent-line: "#a9c0e4"
  vermilion: "#c23b2e"
  vermilion-deep: "#a72e22"
  grid-minor: "rgba(30, 86, 176, 0.05)"
  grid-major: "rgba(30, 86, 176, 0.09)"
  tick: "rgba(28, 42, 58, 0.32)"
typography:
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Segoe UI', 'Microsoft YaHei', system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
  body-sm:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Segoe UI', 'Microsoft YaHei', system-ui, sans-serif"
    fontSize: "12.5px"
    fontWeight: 400
    lineHeight: 1.5
  control:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Segoe UI', 'Microsoft YaHei', system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.5
  control-strong:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Segoe UI', 'Microsoft YaHei', system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.5
  micro-label:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Segoe UI', 'Microsoft YaHei', system-ui, sans-serif"
    fontSize: "10px"
    fontWeight: 600
    letterSpacing: "0.12em"
  status:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Segoe UI', 'Microsoft YaHei', system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 400
  status-label:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Segoe UI', 'Microsoft YaHei', system-ui, sans-serif"
    fontSize: "10px"
    letterSpacing: "0.1em"
  dialog-title:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Segoe UI', 'Microsoft YaHei', system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    letterSpacing: "0.02em"
  numeral:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Segoe UI', 'Microsoft YaHei', system-ui, sans-serif"
    fontSize: "11px"
    fontFeature: "tabular-nums"
  ruler-numeral:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Segoe UI', 'Microsoft YaHei', system-ui, sans-serif"
    fontSize: "8.5px"
    fontFeature: "tabular-nums"
    lineHeight: 1
rounded:
  sheet: "1px"
  radius-1: "2px"
  radius-2: "3px"
  radius-3: "3px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "20px"
  "6": "24px"
components:
  toolbar-button:
    backgroundColor: "{colors.plate}"
    textColor: "{colors.ink}"
    typography: "{typography.control}"
    rounded: "{rounded.radius-2}"
    padding: "4px 11px"
  toolbar-button-hover:
    backgroundColor: "#f6f9fd"
    textColor: "{colors.accent}"
  toolbar-button-pressed:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
  segmented-button:
    backgroundColor: "transparent"
    textColor: "{colors.ink-soft}"
    typography: "{typography.control}"
    rounded: "{rounded.radius-1}"
    padding: "4px 12px"
  segmented-button-active:
    backgroundColor: "{colors.ink}"
    textColor: "#f2f5f8"
    typography: "{typography.control-strong}"
    rounded: "{rounded.radius-1}"
    padding: "4px 12px"
  primary-action:
    backgroundColor: "{colors.accent}"
    textColor: "#ffffff"
    typography: "{typography.control-strong}"
    rounded: "{rounded.radius-2}"
  danger-action:
    backgroundColor: "{colors.vermilion}"
    textColor: "#ffffff"
    typography: "{typography.control}"
    rounded: "{rounded.radius-2}"
    padding: "6px"
    width: "100%"
  list-item:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.radius-1}"
    padding: "6px 8px"
  list-item-active:
    backgroundColor: "{colors.plate}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.radius-1}"
    padding: "6px 8px"
  list-item-selected:
    backgroundColor: "{colors.accent-tint}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.radius-1}"
    padding: "6px 8px"
  page-card:
    backgroundColor: "{colors.plate}"
    rounded: "{rounded.radius-2}"
    padding: "8px"
  text-input:
    backgroundColor: "{colors.plate}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.radius-2}"
    padding: "5px 8px"
  dialog-panel:
    backgroundColor: "{colors.plate}"
    rounded: "{rounded.radius-3}"
    padding: "20px"
    width: "360px"
  status-cell:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink-soft}"
    typography: "{typography.status}"
    height: "30px"
    padding: "0 12px"
---

# Design System: Xunzhi PDF Editor — 工程制图桌

## Overview

**Creative North Star: "工程制图桌 (The Drafting Table)"**

整个应用是一张精确仪器化的制图桌:PDF 文档是铺在桌面上的图幅(drawing sheet),工具栏是工位条,状态栏是图纸右下角的图签(title block),选中操作是修订标记,画布下垫着 8/40px 的制图网格。系统明确拒绝类别默认的 SaaS 面板语言——没有大圆角白卡片、没有含混的灰底浮层;深度来自"纸浮于桌面"的有偏移纸影,边界来自 1px 发丝线。

世界由三种墨水驱动:蓝黑墨(--ink)承担一切文字与激活态墨块;普鲁士蓝(--accent)是操作员的笔,只出现在手会落到或正在起作用的地方;朱砂红(--vermilion)只说危险与错误。表面是一个严格的纸面层级:图纸白(paper)→ 制图桌面(table)→ 面板(panel)→ 纸卡(plate),纹理(制图网格)只属于画布上的桌面,面板永远平整。

密度是仪器密度:13px 基准字号、紧凑控件(4–12px 内距)、微型标注标签(10px 加字距)、表格数字对齐。动效服从"一位(one-bit)"纪律——悬停可渐入(0.12s),按下必须即时反色、无过渡。

**Key Characteristics:**
- 纸面层级五阶:paper / table / panel / plate / plate-sunken,每阶有明确职责
- 普鲁士蓝唯一强调色,纪律性出现;激活模式用墨块而非蓝块
- 1px 发丝线是唯一的分隔语言;边框永远 1px
- 直角优先:2–3px 圆角上限,图幅纸近直角(1px)
- 8/40px 制图网格纹理只衬画布,不上面板
- 微型标注标签 + 表格数字(tabular-nums)构成仪器读数语气
- 制图装置:刻度尺、裁切角标、四角括号、引线标注、墨框印章
- 按下即时反色(墨↔纸),transition: none

## Colors

冷调、低饱和、纸感:全部色板都压在蓝灰相上,唯一的暖色是语义朱砂。配色按"纸面层级 + 三种墨水"分组,而非色相环。

### Primary
- **普鲁士蓝 Prussian Blue** (#1e56b0):唯一强调色。只出现在可操作/激活/进行中的元素上:悬停文字与描边、主操作按钮实底、选中修订标记(边框/外圈)、聚焦环、链接、导出进行中的墨框印章。深阶 #17437f 用于悬停加深;三级晕色 #edf3fb / #dbe8f8 用于悬停底色、草稿选框与聚焦环;#a9c0e4 用于悬停描边与多选边框。

### Secondary
无。系统只有一个强调色,不设第二色相。

### Tertiary(语义色)
- **朱砂红 Vermilion** (#c23b2e):仅语义——危险按钮实底(#a72e22 悬停加深)与状态栏错误文字。永不做装饰、不做选中、不做悬停。

### Neutral(纸面层级)
- **图纸白 Paper** (#fbfcfd):应用最顶层画布底色(app 根)。
- **制图桌面 Table** (#edf0f4):画布衬底——阅读画布与页面网格的底色,制图网格画在它上面;也用作缩略图占位与悬停底。
- **面板 Panel** (#f4f6f9):工具栏/侧栏/检查器/状态栏/刻度尺的底色,永远平整无纹理。
- **纸卡 Plate** (#ffffff):一切"纸"的表面——卡片、浮层菜单、输入框、对话框、图幅页。
- **凹槽 Plate-sunken** (#e9edf2):分段控件(模式切换器/工具组)的下陷槽底。

### Neutral(墨线文字)
- **蓝黑墨 Ink** (#1c2a3a):主文字、激活态墨块、按下反色底。
- **次级墨 Ink-soft** (#46586c):次级文字、非激活分段按钮、状态栏值。
- **标注墨 Ink-mute** (#6f7f92):三级文字、微型标注标签、页码计数。
- **淡墨 Ink-faint** (#9fabbb):禁用、占位、标注记号小方框。
- **刻度墨 Ink-numeral** (#5d6e81):仪器刻度数字专用(面板上对比度 4.8:1),目前用于刻度尺数字。

### Neutral(发丝线)
- **发丝线 Hairline** (#dde3ea):弱分隔——菜单分隔线、标题条下划线、缩略图描边。
- **强发丝线 Hairline-strong** (#c8d1db):区域分隔与控件描边——工具栏/侧栏/检查器/状态栏边界、按钮与输入框边框。

### 纹理色(仅画布)
- **网格·细 Grid Minor** (rgba(30, 86, 176, 0.05)) / **网格·粗 Grid Major** (rgba(30, 86, 176, 0.09)):8/40px 制图网格,只画在 table 底的画布上。
- **刻度 Tick** (rgba(28, 42, 58, 0.32)):刻度尺大格刻度(小格用同色 0.16 透明度)。

### Named Rules

**操作员蓝纪律(The Operator's Blue Rule)。** 普鲁士蓝只落在"手会落到或正在起作用"的元素上:可点击的悬停反馈、主操作实底、选中修订标记、聚焦、链接、进行中印章。静止的文字、边框、表面永远不是蓝的。检验法:这个元素现在能被点击吗?它正在进行吗?两个都否,就不能是蓝的。

**墨块规则(The Ink Block Rule)。** 激活的模式/工具是实心墨块(--ink 底 + 纸色文字),不用蓝色——保证任何时候只有一个"工位"读数在发光,蓝留给动作。

**朱砂语义规则(The Vermilion Rule)。** 朱砂红只表达危险/错误两种语义。不装饰、不选中、不悬停变色。

## Typography

**Body Font:** 系统栈(-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Segoe UI', 'Microsoft YaHei', system-ui)— 中文优先的桌面系统字,无衬线,不引入外部字体。
**Label/Mono:** 无独立等宽字体;数字通过 `font-variant-numeric: tabular-nums` 获得表格对齐。

**Character:** 仪器面板的字体气质——小、密、准。层级不靠大字号靠字重与字距:微型标注标签(10px/600/0.12em)是章节语气,正文 13px 从不放大,数字永远表格对齐像刻度读数。

### Hierarchy
- **Dialog Title** (600, 13px, 0.02em):对话框/空态图纸签的题头,通栏题头 + 发丝线下划线。
- **Body** (400, 13px, 1.5):应用基准字号,一切正文与空态说明。
- **Body-sm** (400, 12.5px, 1.5):列表项、表单标签、对话框输入、检查器属性行。
- **Control** (500, 12px, 1.5):按钮与分段控件文字;激活态升为 600(control-strong)。
- **Status** (400, 11px):状态栏整条;其中 status-label 为 (400, 10px, 0.1em)。
- **Micro-label** (600, 10px, 0.12em):侧栏/检查器/属性区的章节标题,标注墨色,前置 6px 空心小方框。
- **Numeral** (11px, tabular-nums):一切会变的数字——缩放百分比、页码、计数、图签数值。
- **Ruler Numeral** (8.5px, tabular-nums):刻度尺数字,刻度墨色,每 40px 一枚。

### Named Rules

**微型标注规则(The Micro-Label Rule)。** 章节标题一律是微型标注标签:10px、600、0.12em 字距、标注墨色,侧栏与检查器的标题再前置一枚 6px 空心方框(1.5px 淡墨描边)——图纸签注的语气,不用大标题。

**表格数字规则(The Tabular Numeral Rule)。** 任何会更新的数字(缩放、页码、选中数、刻度、坐标)必须 `font-variant-numeric: tabular-nums`;仪器刻度数字另用刻度墨 --ink-numeral。数字是读数,不是文案。

## Layout

单窗口桌面应用(Electron,目标桌面宽度 1280–1600),无响应式断点;布局是固定的制图工位:

```
┌──────────────────────────────────────────────┐
│ 工具栏(工位条,可换行到第二行)              │
├────────┬──────────────────────────┬──────────┤
│ 侧栏   │ 画布(桌面 + 网格纹理)   │ 检查器   │
│ 216px  │ 阅读视图 / 页面图幅墙     │ 460px    │
│        │                          │ (内容编辑│
│        │                          │  172px)  │
├────────┴──────────────────────────┴──────────┤
│ 状态栏(图签,30px,分格)                    │
└──────────────────────────────────────────────┘
```

- **间距节奏:** 4/8/12/16/20/24px 六阶(--space-1…6);控件内距紧凑(按钮 4px 11px,列表项 6px 8px),区域间 16–24px。
- **侧栏:** 216px 定宽,右缘强发丝线,内距 12px 8px。
- **检查器:** 460px 定宽(页面编辑)或 172px(内容编辑),左缘强发丝线。
- **页面图幅墙:** `repeat(auto-fill, minmax(156px, 1fr))` 网格,间距 16px,画布内距 20px,顶对齐。
- **阅读画布:** 页垂直连续居中,页间距 32px,上内距 24px、下 56px(给页码标签留位,标签悬于纸下 26px)。
- **画布顶部刻度尺:** 18px 高,大格每 40px(刻度 10px 高 + 数字),小格每 8px(刻度 5px 高),静态屏幕坐标。

### Named Rules

**画布网格规则(The Canvas Grid Rule)。** 8/40px 制图网格纹理只允许出现在 table 底的画布表面(阅读画布、页面图幅墙)。工具栏、侧栏、检查器、状态栏永远平整——桌面有网格,仪器面板没有。

## Elevation & Depth

深度是"纸浮于桌面":所有阴影都有真实的向下偏移与柔和扩散,且统一染墨蓝(rgba(18, 34, 56, …))而不是中性黑——纸影投在冷色桌面上。四级阴影对应四种浮起高度,悬停抬升只发生一次(+1px translateY),没有悬浮魔法。

### Shadow Vocabulary
- **纸卡影 shadow-card** (`0 1px 2px rgba(18, 34, 56, 0.06)`):静止纸卡的最低浮起——文档列表当前项、页面卡、检查器预览。
- **纸片影 shadow-plate** (`0 1px 2px rgba(18, 34, 56, 0.07), 0 8px 24px -8px rgba(18, 34, 56, 0.18)`):浮起一层的纸片——右键菜单、标注提示条;也用作悬停时的抬升影。
- **图幅影 shadow-sheet** (`0 1px 2px rgba(18, 34, 56, 0.10), 0 12px 32px -12px rgba(18, 34, 56, 0.22)`):真正的"纸"——阅读视图的 PDF 页、空态图纸签。
- **弹层影 shadow-pop** (`0 2px 4px rgba(18, 34, 56, 0.08), 0 16px 40px -12px rgba(18, 34, 56, 0.26)`):最高浮起——模态对话框。

### Named Rules

**纸浮于桌面规则(The Paper-on-Table Rule)。** 阴影永远是"纸的影子":小接触影 + 向下柔散,墨蓝染色,四级封顶(card/plate/sheet/pop)。面板在静止时不带阴影——深度只属于"纸",仪器面板靠发丝线分隔。

## Shapes

直角优先的制图仪器语言。圆角三阶:radius-1 = 2px(分段按钮、列表项、小方框类)、radius-2 = 3px(按钮、输入框、页面卡,工作默认)、radius-3 = 3px(对话框,与 radius-2 同值);图幅纸近直角(1px)。全系统只有两处越线,且都是"仪器"而非"盒子":滚动条墨杆(5px 圆杆)与引线标注的落点圆点(5px 圆规点)。

边框只有一种粗细:1px。强调不是加粗,而是双描边——按下时 `inset 0 0 0 1px` 墨圈压印,选中时 `box-shadow: 0 0 0 1px` 外圈;画布上的标注对象选中用 1–1.5px 蓝圈。

线框装置(皆为 1px 线构成的制图记号):
- **裁切角标:** 阅读视图图幅页左上/右下对角 10×10px 直角标记,偏移 -13px。
- **四角括号:** 页面卡选中时四角 10×2px 蓝色 L 形括号(修订标记)。
- **标注小方框:** 微型标签前的 6px 空心方框(1.5px 淡墨)。
- **引线标注:** 空态注释的肘形引线(11px 横线 + 5px 落点圆点,蓝 55–70% 透明度),起点压在图纸边框上。
- **墨框印章:** 导出进行中状态用 currentColor 描边的小方框戳记。

## Components

### Buttons(工位按钮)
墨线描边的纸卡小片,12px/500 文字,4px 11px 内距,3px 圆角,强发丝线描边。
- **Hover:** 文字转普鲁士蓝、描边转 accent-line、底色转 #f6f9fd 洗蓝,0.12s ease-out。
- **Pressed(one-bit):** 即时反色——墨底纸字,`transition: none`,无渐入。
- **Disabled:** 透明度 0.38 + not-allowed 光标。
- **图标:** 内联 SVG,stroke: currentColor,宽 2,14–16px,不用图标字体。

### Segmented Controls(工位分段:模式切换器 / 工具组)
下陷槽(--plate-sunken 底 + 强发丝线描边 + 2px 内距 + 2px 缝隙),内嵌透明格。
- **Active:** 实心墨块(墨底 #f2f5f8 字,600 字重)——不是蓝块。
- **Hover(非激活):** 墨色文字 + 65% 白底。
- **Pressed(非激活):** 纸白底 + `inset 0 0 0 1px` 墨圈压印——不复制激活墨块,保持单一工位读数。

### Primary Action(主操作:应用/提交)
- **Shape:** 3px 圆角,实底普鲁士蓝、白字、600 字重。
- **States:** 悬停与按下都加深为 #17437f;禁用 0.38。一个状态区只给一个真正的主操作。

### Danger Action(危险操作:清空标注等)
- **Shape:** 3px 圆角,实底朱砂红、白字;悬停/按下加深 #a72e22,按下无过渡。

### Inputs / Fields(输入与字段)
- **Style:** 纸卡底、强发丝线 1px 描边、3px 圆角;数字输入(页码跳转、坐标、缩放)一律 tabular-nums。
- **Focus:** 描边转普鲁士蓝 + `0 0 0 2px` accent-tint-2 晕环;全局 :focus-visible 为 2px 蓝描边 outline(offset 1px)。
- **Browser surfaces 也属于设计:** ::selection 为蓝 20% 洗色,checkbox 用 accent-color。

### Sidebar Document List(图纸列表)
12.5px 列表项,6px 8px 内距,2px 圆角,前置 16px 文档图标(淡墨)。
- **Active(当前文档):** 纸卡浮起——plate 底 + 强发丝线 + 纸卡影 + 500 字重。
- **Selected(多选待操作):** 修订标记——accent-tint 底 + accent-line 描边,图标与计数转蓝。
- **Active + Selected:** 保持纸卡,描边转蓝 + `inset 0 0 0 1px` 蓝圈。
- **列表头:** 微型标注标签 + 6px 空心方框。

### Page Card(图幅缩略卡,页面编辑)
纸卡(3px 圆角、强发丝线、纸卡影、8px 内距),缩略图围 1px 发丝线。
- **Hover:** 描边加深、影升为纸片影、translateY(-1px)。
- **Selected:** 蓝描边 + `0 0 0 1px` 蓝圈 + 四角 10×2px 蓝括号;页码转蓝加粗。
- **Deleted:** 透明度 0.35。

### Reader Sheet(阅读图幅)
近直角纸页(1px 圆角、rgba(28,42,58,0.14) 描边、图幅影),对角裁切角标,页码标签(11px 表格数字)悬于纸下 26px;渲染占位为凹槽底 + "第 N 页"。画布上方常驻 18px 刻度尺。

### Empty State(空态图纸签)
340px 纸卡(图幅影),题头为通栏图纸签(13px/600/0.02em + 发丝线下划线),说明文字是**引线标注**:每条注释从图纸边框引出一条 11px 肘形引线 + 5px 落点圆点(蓝 55–70% 透明度),12px/1.7 次级墨。

### Status Bar(图签 title block)
30px 高分格图签:面板底、顶部强发丝线、11px 表格数字;每格 = status-label(10px/0.1em 标注墨)+ 值,格间 1px 发丝线竖隔,伸展格不带右边线。文档名格最宽 280px 超出省略。导出中 = 蓝色 currentColor 描边墨框印章(600、0.08em 字距);错误 = 朱砂文字;右端推广格以左发丝线隔开,URL 为蓝色可点链接(悬停加深 + 下划线)。

### Dialogs(图纸签弹层)
overlay 为 rgba(15, 26, 41, 0.46) 墨纱,弹层为纸卡(3px 圆角、强发丝线、弹层影、20px 内距、最小宽 360px)。题头通栏贴边(负外距)带发丝线下划线;操作行顶部 1px 发丝线,右对齐,提交钮 = 普鲁士蓝实底。

### Annotation Overlay(标注修订层,内容编辑)
- **选中:** 对象外圈 1–1.5px 蓝环;八方位缩放手柄为 8px 纸白小方点(1px 蓝描边,1px 圆角)——制图控制点。
- **拖拽草稿:** 1px 蓝色虚线框 + accent-tint 底,60% 透明。
- **文字批注输入框:** 蓝描边 + 2px 晕环,纸卡底。
- **操作提示条:** 墨色小药丸(11px 纸色字),纸片影。

## Do's and Don'ts

### Do:
- **Do** 用普鲁士蓝回答"这里能操作吗":悬停、主操作、选中、聚焦、链接、进行中印章——其余一律墨色。
- **Do** 激活的模式/工具用墨块(--ink 底),且同一时刻只允许一个墨块工位。
- **Do** 给一切会变的数字加 `font-variant-numeric: tabular-nums`;刻度类数字用 --ink-numeral。
- **Do** 章节标题用微型标注标签(10px/600/0.12em + 标注墨,可加 6px 空心方框)。
- **Do** 面板之间用 1px 发丝线分隔(区域用 --hairline-strong,格内用 --hairline)。
- **Do** 按下即反色:`:active` 一律 `transition: none`,分段控件非激活格用白底 + inset 墨圈。
- **Do** 从四级纸影 vocabulary 里选阴影(card/plate/sheet/pop),不要自造。
- **Do** 用内联 SVG 线性图标(stroke: currentColor,宽 2,14–16px)。

### Don't:
- **Don't** 把普鲁士蓝用在静止的文字、标题、边框或背景上——蓝色必须能通过"可操作/激活/进行中"检验。
- **Don't** 引入第二个强调色相,或把朱砂红当装饰/选中/品牌色用(它只说危险与错误)。
- **Don't** 圆角超过 3px(全系统仅滚动条墨杆 5px 与引线圆点两处仪器例外)。
- **Don't** 给按压状态加过渡动画——一位纪律,按下即终态。
- **Don't** 把制图网格纹理或阴影放上工具栏/侧栏/检查器/状态栏——纹理只属于画布桌面。
- **Don't** 用加粗描边表达强调——边框恒 1px,强调用双描边(inset 圈 / 外圈 / 画布对象 1.5px 蓝环)。
- **Don't** 用图标字体或 emoji 当图标;不用外部字体,系统栈即规范。
