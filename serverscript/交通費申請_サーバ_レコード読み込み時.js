// 交通費申請　サーバスクリプト　レコード読み込み時
try {
    const userId = context.UserId;
    const st = model.Status;
    const KEIRI_GROUP_ID = 2;
    const GAAPP_GROUP_ID = 3;

    // 1. 権限判定
    const isKeiri = groups.Get(KEIRI_GROUP_ID).ContainsUser(userId);
    const isGAApp = groups.Get(GAAPP_GROUP_ID).ContainsUser(userId);
    const isApplicant = (userId.toString() === model.ClassA || userId.toString() === model.ClassD);
    const isSuperior = (userId.toString() === model.ClassB);

    // 2. 表示・読み取り専用制御 (JSで書いていたロジックをサーバーへ)
    // 申請者かつ作成中/差し戻し以外はすべて読み取り専用に
    const canEdit = (isApplicant && (st == 100 || st == 910)) || (isKeiri && true); // 特例含む

    if (!canEdit) {
        // 全項目を読み取り専用に設定（サーバー側で設定するとハッキング不可）
        columns.Get().forEach(column => {
            column.ReadOnly = true;
        });
    }

    // 3. 【目玉機能】経路履歴とお気に入りのHTMLを作成
    // JavaScriptでAjaxしていた処理を、ここで「items.Get」を使って直接取得
    const HIST_TABLE_ID = 8;
    const historyItems = items.Get(HIST_TABLE_ID, JSON.stringify({
        View: {
            ColumnFilterHash: { ClassD: JSON.stringify([userId.toString()]) },
            ColumnSorterHash: { CreatedTime: "desc" }
        },
        PageSize: 5
    }));

    let histHtml = '<table class="grid" style="width:100%; font-size:12px;">';
    histHtml += '<thead style="background:rgba(128,128,128,0.1);"><tr><th></th><th>行先</th><th>経路</th><th>金額</th></tr></thead><tbody>';
    
    Array.from(historyItems).forEach(item => {
        const copyData = {
            Title: item.Title,
            ClassA: item.ClassA,
            ClassB: item.ClassB,
            ClassD: item.ClassC,
            NumC: item.NumA,
            _mode: 'copy'
        };
        const jsonStr = JSON.stringify(copyData).replace(/"/g, '&quot;');
        
        histHtml += `<tr>
            <td><button type="button" class="select-route-btn ui-button" data-json="${jsonStr}">選択</button></td>
            <td>${item.Title}</td>
            <td>${item.ClassA} → ${item.ClassB}</td>
            <td style="text-align:right;">${item.NumA.toLocaleString()}円</td>
        </tr>`;
    });
    histHtml += '</tbody></table>';

    let escapedHtml = histHtml.replace(/\\/g, '\\\\').replace(/`/g, '\\`');
    context.ExecuteClientScript("window.ServerHistHtml = `" + escapedHtml + "`;");

} catch (e) {
    context.Log("ロード時スクリプトエラー: " + e.message);
}