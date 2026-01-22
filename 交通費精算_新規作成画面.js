//<定数定義>
const CLASS_USER = "ClassA"; //「申請者」項目
//onst CLASS_MAN = "ClassB";  //「上長」項目
const CLASS_CREATOR = 'ClassD'; //「作成者」(User ID)

//「従業員一覧」テーブルID
//const WORKERTABLE_ID = 15337991;
//const WORKERTABLE_CLASS_USER = "ClassQ"; //「ユーザーID」項目
//const WORKERTABLE_CLASS_MAN = "ClassR";  //「上長」項目

//<対象項目の非表示化>
// ※注意: これはクライアントスクリプト(画面読込時など)用の書き方です
const targetIds = ['DateB', 'DateC', 'ClassC', 'NumA'];
targetIds.forEach(function(id) {
    // $p.getFieldが要素を返さない場合の安全策を追加しておくとベターです
    let field = $p.getField(id);
    if (field && field.length > 0) {
        let classField = field[0].id;
        $('#' + classField).hide();
    }
});

//<規定値入力>
// 1. ユーザーＩＤ取得
let userId = $p.userId();

//「申請者」欄と「作成者」欄にログインユーザーIDを入力
$p.set($p.getControl(CLASS_USER), $p.userId());
$p.set($p.getControl(CLASS_CREATOR), $p.userId());

/*
// 2. 「従業員一覧」レコード検索取得
$p.apiGet({
    id: WORKERTABLE_ID,
    data: {
        View: {
            "ColumnFilterHash": {
                // ここもブラケット記法を使っているため、正しい記述です
                [WORKERTABLE_CLASS_USER]: "[\"" + userId + "\"]"
            }
        }
    },
    done: function (data) {
        //alert('通信が成功しました。');
        console.log(data);

        // データが見つかった場合のみ処理する（エラー防止）
        if (data.Response.Data && data.Response.Data.length > 0) {
            
            // 3.レコードID抽出
            let userIdOnWorkerTable = data.Response.Data[0].ResultId;
            console.log('DEBUG: userIdOnWorkerTable = ' + userIdOnWorkerTable);
            
            // 4.「申請者」項目にレコードID代入
            $p.set($p.getControl(CLASS_USER), userIdOnWorkerTable);
            
            // 5.上長レコードID取得
            // ★ここを修正しました★
            let manIdOnWorkerTable = data.Response.Data[0][WORKERTABLE_CLASS_MAN];
            
            // 6. 「上長」項目にレコードID代入
            $p.set($p.getControl(CLASS_MAN), manIdOnWorkerTable);

        } else {
            console.log('DEBUG: 従業員マスタに該当するユーザーが見つかりませんでした。');
        }
    },
    fail: function(data){
        alert('通信が失敗しました');
    }
});
*/