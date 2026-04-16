/** 公众号板块优先展示的账号（央媒）；也用于聚合加权 */
export const PRIORITY_GZH_ACCOUNTS = ["人民日报", "新华社", "央视新闻"] as const

export function isPriorityGzhAuthor(author: string | undefined | null): boolean {
  if (!author) return false
  return PRIORITY_GZH_ACCOUNTS.some((name) => author.includes(name))
}
