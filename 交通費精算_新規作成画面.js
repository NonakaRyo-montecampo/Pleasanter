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
