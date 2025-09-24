import { bitable, ITableMeta } from "@lark-base-open/js-sdk";
import { Button, Form } from '@douyinfe/semi-ui';
import { BaseFormApi } from '@douyinfe/semi-foundation/lib/es/form/interface';
import { useState, useEffect, useRef } from 'react';

import './App.css';

// 添加从URL获取File的函数（优化：自动识别MIME类型）
const fetchUrlToFile = async (url: string, filename: string): Promise<File> => {
  const response = await fetch(url, {
    mode: "cors",
    credentials: "include",
  });
  // 从响应头获取MIME类型，未知类型时使用通用二进制类型
  const mimeType = response.headers.get('Content-Type') || 'application/octet-stream';
  const blob = await response.blob();
  return new File([blob], filename, { type: mimeType });
};

const getFileList = async (link: string) => {
  const searchObj = Object.fromEntries(new URLSearchParams(link.split('?')[1]));
  console.log(searchObj)
  const res = await fetch(`https://www.feishu.cn/approval/admin/api/attachment/listApprovalAttachment?locale=zh_cn`, {
    method: 'POST',
    headers: {
      "x-larkgw-use-lark-session": "1",
    },
    mode: "cors",
    credentials: "include",
    body: JSON.stringify({
      key: searchObj.key,
    }),
  }).then(res => res.json());
  console.log('[res]', res);
  return res;
}

export default function App() {
  const [tableMetaList, setTableMetaList] = useState<ITableMeta[]>([]);
  const [activeTableId, setActiveTableId] = useState<string>();
  const [fieldMetaList, setFieldMetaList] = useState<{name: string, id: string}[]>([]);
  const [count, setCount] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const formApi = useRef<BaseFormApi>();

  const start = async (val: { input: string, output: string }) => {
    if(!val.input || !val.output || !activeTableId) {
      alert(`请选择数据`);
      return;
    }
    const table = await bitable.base.getTableById(activeTableId);
    const filedList = await table.getFieldList();
    const inputFiled = filedList.find(i => i.id === val.input);
    const outputFiled = filedList.find(i => i.id === val.output);
    if (!inputFiled) {
      alert(`输入字段无效`);
      return;
    }
    if (!outputFiled) {
      alert(`输出字段无效`);
      return;
    }
    const recordObj = await table.getRecordList();
    console.log('recordObj', recordObj, inputFiled);
    const recordList = (recordObj as any).recordList as any[];
    setCount(recordList.length);
    setIsRunning(true);
    for (const record of recordList) {
      const cell = await inputFiled.getCell(record.recordId);
      const inputValues = await cell.getValue();
      for (const _val of inputValues) {
        console.log('[-val]', _val);
        try {
          const resData = await getFileList(_val.link);
          const list = [];
          for (const res of resData.data.attachmentWidget[0].attachements) {
            // const file = new File(['text2222'], 'file_name.txt', { type: "text/plain" });
            const file = await fetchUrlToFile(
              res.url,
              res.name,
              // 'https://api3-eeft-drive.feishu.cn/space/api/box/stream/download/all/IU63bk6IJoXSb6xZnvKcQhHPnng',
              // 'https://s.17win.com/snack/115/2fdcbf38dacb48499ff4493abb3c61f9.png',
              // 'Screenshot_2025-09-11-14-02-26-763_com.ss.android.lark.jpg'  // 文件名可从URL提取或自定义
              // '1231.png'  // 文件名可从URL提取或自定义
            );
            list.push(file)
          }
          console.log(list, 1111)
          if (!list.length) throw `文件获取失败 `;
          const outputCell = await outputFiled.getCell(record.recordId);
          await outputCell.setValue(list);
          const vals = await outputCell.getValue();
          console.log('写入的value', vals);
        } catch (err) {
          console.error(err);
          throw err;
        }
      }
      setCount(val => val - 1)
    }
    setIsRunning(false);
    console.log('写入完成！！');
  };

  const onSelect = async (tableId: string) => {
    if (tableId) {
      setActiveTableId(tableId);
      const table = await bitable.base.getTableById(tableId);
      const _fieldMetaList = await table.getFieldMetaList();
      console.log('_fieldMetaList', _fieldMetaList);
      setFieldMetaList(_fieldMetaList)
    }
  }

  useEffect(() => {
    Promise.all([bitable.base.getTableMetaList(), bitable.base.getSelection()])
      .then(([metaList, selection]) => {
        setTableMetaList(metaList);
      });
  }, []);

  return (
    <main className="main">
      <Form labelPosition='top'
            disabled={isRunning}
            onSubmit={start}
            getFormApi={(baseFormApi: BaseFormApi) => formApi.current = baseFormApi}>
        <Form.Select field='table'
                     label='选择表'
                     placeholder="请选择"
                     onSelect={(val: any) => onSelect(val)}>
          {
            Array.isArray(tableMetaList) && tableMetaList.map(({ name, id }) => {
              return (
                <Form.Select.Option key={id} value={id}>{name}</Form.Select.Option>
              );
            })
          }
        </Form.Select>
        <div>
          <Form.Select field='input' label='选择输入字段' placeholder="请选择">
            {
              fieldMetaList.map(({ name, id }) => {
                return (
                  <Form.Select.Option key={id} value={id}>
                    {name}
                  </Form.Select.Option>
                );
              })
            }
          </Form.Select>
          <Form.Select field='output' label='选择输出字段' placeholder="请选择">
            {
              fieldMetaList.map(({ name, id }) => {
                return (
                  <Form.Select.Option key={id} value={id}>
                    {name}
                  </Form.Select.Option>
                );
              })
            }
          </Form.Select>
        </div>
        <Button theme='solid' htmlType='submit'>执行</Button>
        {isRunning && (<div style={{marginTop: 20}}>剩余 {count} 条数据</div>)}
      </Form>
    </main>
  )
}
