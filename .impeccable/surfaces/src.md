---
version: 1
slug: "src"
primary_target: "src"
related_targets: []
---

# Surface Brief — 应用整体(src)

Scope: 整个桌面应用外壳(工具栏/侧栏/画布/检查器/状态栏),Operate 模式。单一 Electron 窗口,桌面宽度 1280–1600。

Audience: 通用办公用户;Job: 阅读/批注/整理 PDF;Action: 标注→烘焙→另存为;Constraints: 中文 UI、广告条保留在状态栏、三种模式同等重要、不改任何产品术语与功能行为。

Direction: 工程制图桌(assigned #6, seed 8560264e, code-led)。文档是图幅,状态栏是图签,选择是修订标记,画布下垫制图网格。

## Direction contract

THESIS: 把 PDF 文档当图纸对待——精确仪器化的制图桌面,拒绝类别默认的白卡片+大圆角+柔和阴影的 SaaS 面板语言。

OWN-WORLD: 冷调制图纸白底;蓝黑墨线文字;普鲁士蓝唯一强调色,只出现在可操作/激活元素上;朱砂红仅作语义色(危险/必填警示);1px 发丝分隔线;8/40px 制图网格只衬画布;直角优先(3px 圆角上限);微型标签加字距;表格数字对齐;图签式分格状态栏。

STORY: 用户打开即知这是一台文档仪器:三种模式是同一张制图桌的三个工位;选中页带修订标记;图签随时报告文档、页码、缩放;导出即定版。

FIRST VIEWPORT: 顶部工位条(模式分段+文件操作),左栏文档图纸列表(纸边标签语气),中央画布(刻度尺+网格衬底+图幅页影),底部图签式状态栏含推广格。

FORM: assigned direction #6 of grounded list(七向清单:印刷打样/朱批台/装订作坊/牛皮档案/文具桌面/制图桌/卡片目录),seed key 8560264e,code-led(无图像生成)。

Raises: tensegrity→空态用引线标注;warm-consumer→强调色只在可操作元素;one-bit→按下即时反色无渐入;nixie→图签数字变化可见;cape→单强调色纪律;zoo→一套网格系统驱动画布/纹理/标记。

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.
