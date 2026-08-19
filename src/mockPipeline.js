export const MOCK_PIPELINE_STAGES = [
  { key: 'input', label: '输入已解析' },
  { key: 'recognition', label: 'MolScribe 识别完成' },
  { key: 'render', label: 'RDKit 渲染完成' },
  { key: 'compare', label: '视觉差异检查完成' },
  { key: 'final', label: '结果已生成' },
];

const DEMO_NAMES = ['molecule_01.png', 'molecule_02.png', 'paper_page_03.png'];
const DEMO_SMILES = [
  'CC(=O)N1CCC(Nc2ccc3c(c2)C(=O)N(CC3)C)CC1',
  'COc1ccc(C(=O)Nc2nccs2)cc1',
  'O=[N+]([O-])c1ccc(Cl)cc1',
];

function sketchVariant(index) {
  return {
    rings: index % 3 === 0 ? 2 : 1,
    accent: index % 2 === 0 ? '#19d3aa' : '#6f6cff',
  };
}

export function buildMockSamples(uploads, useDemo = false) {
  const source = useDemo
    ? DEMO_NAMES.map((name) => ({ name, type: 'PNG', previewUrl: null }))
    : uploads;
  return source.map((item, index) => ({
    id: `sample-${Date.now()}-${index}`,
    name: item.name,
    type: item.type,
    previewUrl: item.previewUrl,
    status: 'PROCESSING',
    progress: 4,
    currentStage: 'input',
    smiles: DEMO_SMILES[index % DEMO_SMILES.length],
    molfile: `MolWeave\n  RDKit          2D\n\n ${18 + index} ${20 + index}  0  0  0  0  0  0  0  0999 V2000\n  ... preview only ...\nM  END`,
    reason: index % 4 === 3
      ? '视觉模型报告局部立体信息不确定，已安全送入人工复核。'
      : '结构通过图一致性检查与独立视觉盲审。',
    events: [{ label: '文件已加入任务', time: '刚刚' }],
    sketch: sketchVariant(index),
  }));
}
