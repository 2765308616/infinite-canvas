import type { Node, NodeProps } from '@xyflow/react'

export type GroupFlowNode = Node<Record<string, unknown> & { title: string; count: number }, 'groupBackdrop'>

export default function GroupNode({ data }: NodeProps<GroupFlowNode>) {
  return <div className="group-backdrop"><div className="group-backdrop__header">{data.title}<span>{data.count} 张卡片</span></div></div>
}
