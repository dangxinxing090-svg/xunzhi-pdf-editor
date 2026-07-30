/**
 * 解析页码模板:{n} -> 当前页码(1-based),{total} -> 文档总页数。
 * 无占位符则原样返回。供页码标注(pageNumber)在渲染与烘焙时统一调用。
 */
export function resolvePageNumberText(template: string, n: number, total: number): string {
  return template
    .split('{n}').join(String(n))
    .split('{total}').join(String(total));
}
